# IMEI Lookup Performance — Recommended Implementation Plan

**Context**: Manual sales use `lookupIdentifierByImei` which fires 2–3 sequential Supabase round-trips
per lookup (identifiers → inventory → inventory_colors). Upload validation fires one Supabase query
per 80-item batch but the batches run sequentially. At scale (thousands of IMEIs, high concurrency)
both paths feel slow. This doc recommends a layered approach from highest ROI to lowest effort.

---

## Where Does "In-Memory" Actually Live?

**Short answer: the browser's JavaScript heap (V8 RAM), per tab.**

When we say "in-memory identifier map" we mean a `Map<string, IdentifierFullLookup>` that lives as
a plain JavaScript object in the browser tab's memory. Specifically:

| Property               | Detail                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| Storage location       | Browser tab → V8 heap (RAM on the user's machine)                               |
| Shared between tabs?   | No — each tab has its own JS heap                                               |
| Survives page refresh? | No — the Map is garbage-collected; TanStack Query re-fetches on next mount      |
| Persisted to disk?     | No — unlike `localStorage` or IndexedDB this is pure RAM                        |
| Visible to the server? | No — it never leaves the client                                                 |
| Cleared when?          | Tab close, navigation away, or when TanStack Query garbage-collects stale cache |

TanStack Query (`useQuery`) owns the object and controls its lifetime via `staleTime` and `gcTime`.
The `useMemo`-derived `Map` is just a secondary index over whatever TanStack has cached — it does not
hold data independently.

This is the correct place for this data because:

1. Each company's IMEI list is user/session-specific — no value in a shared server cache.
2. The dataset is bounded (a company typically has <50 k active identifiers; ~10–20 MB max).
3. Re-fetching on refresh is fine because TanStack rehydrates from Supabase in one batch query.

---

## Tier 1 — Do These First (High ROI, Low Risk)

### 1A — In-Memory Identifier Map via TanStack Query

**The problem**: `lookupIdentifierByImei` fires 2–3 sequential DB round-trips every time the user
types/scans an IMEI in the Manual Sale modal. Even with fast Supabase, 3 round-trips ≈ 300–600 ms.

**The fix**: Fetch ALL active identifiers for the company once, cache with TanStack Query
(`staleTime: 5 minutes`), and derive a `Map<imei, IdentifierFullLookup>` in memory for O(1) lookup.

**New file**: `src/hooks/use-identifier-map.ts`

```ts
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { useCompany } from "@/contexts/CompanyContext";
import { queryKeys } from "@/lib/query-keys";
import type { IdentifierFullLookup } from "@/types/inventory-identifiers";

const STALE_MS = 5 * 60 * 1000; // 5 minutes

async function fetchAllActiveIdentifiers(companyId: string): Promise<IdentifierFullLookup[]> {
  const supabase = createClient();
  // Single JOIN query — replaces the 3-round-trip sequential pattern.
  // Fetches in_stock + reserved only; sold devices are excluded from the
  // lookup map because they cannot be sold again.
  const { data, error } = await (supabase.from("inventory_identifiers") as any)
    .select(
      `
      id,
      imei,
      serial_number,
      status,
      sold_at,
      color,
      inventory!inner (
        id, brand, device_name, grade, storage, selling_price, hst,
        purchase_price, quantity, company_id
      )
    `,
    )
    .eq("company_id", companyId)
    .in("status", ["in_stock", "reserved"]);

  if (error) throw error;
  // Map raw rows → IdentifierFullLookup using existing mapper
  return (data ?? []).map(mapRawIdentifierRow);
}

export function useIdentifierMap() {
  const { companyId } = useCompany();

  const { data: identifiers = [] } = useQuery({
    queryKey: queryKeys.identifierMapAll(companyId),
    queryFn: () => fetchAllActiveIdentifiers(companyId),
    staleTime: STALE_MS,
    enabled: !!companyId,
  });

  // O(1) lookup by IMEI (lowercase) and by serial number (lowercase)
  const byImei = useMemo(() => {
    const map = new Map<string, IdentifierFullLookup>();
    for (const row of identifiers) {
      if (row.imei) map.set(row.imei.toLowerCase(), row);
    }
    return map;
  }, [identifiers]);

  const bySerial = useMemo(() => {
    const map = new Map<string, IdentifierFullLookup>();
    for (const row of identifiers) {
      if (row.serialNumber) map.set(row.serialNumber.toLowerCase(), row);
    }
    return map;
  }, [identifiers]);

  const lookup = (value: string): IdentifierFullLookup | null => {
    const v = value.trim().toLowerCase();
    return byImei.get(v) ?? bySerial.get(v) ?? null;
  };

  return { lookup, byImei, bySerial, identifiers };
}
```

**Add to `src/lib/query-keys.ts`**:

```ts
// Full identifier map (all active) for O(1) in-memory lookup
identifierMapAll: (companyId: string) => ["identifiers", "map", companyId] as const,
```

**Usage in `ManualSaleWizard` / `ManualSaleModal`**:

```ts
// Replace: await lookupIdentifierByImei(companyId, imei)  →  instant Map lookup
const { lookup } = useIdentifierMap();
const result = lookup(scannedImei); // synchronous, 0 ms
```

**Size estimate**: 50 000 rows × ~300 bytes each ≈ 15 MB heap. Well within browser limits.
For smaller companies (< 5 000 IMEIs) this is < 2 MB.

---

### 1B — Parallelise Upload Validation Batch Queries

**The problem**: `mergeDatabaseIdentifierConflicts` in `upload-identifier-validation.ts` runs IMEI
batches and serial batches in sequential `for` loops. 500 IMEIs = 7 sequential DB round-trips.

**The fix**: `Promise.all` over the batch arrays so all chunks fire in parallel.

**File**: `src/lib/export/upload-identifier-validation.ts`

```ts
// BEFORE (sequential)
for (const batch of chunkArray([...imeiValues], CHUNK)) {
  const { data, error } = await db.from("inventory_identifiers")...
}

// AFTER (parallel)
const imeiResults = await Promise.all(
  chunkArray([...imeiValues], CHUNK).map((batch) =>
    db.from("inventory_identifiers")
      .select("imei, status")
      .eq("company_id", companyId)
      .not("imei", "is", null)
      .in("imei", batch)
  )
);
for (const { data, error: e } of imeiResults) {
  if (e) throw new Error(`Could not verify IMEI uniqueness: ${e.message}`);
  for (const row of data ?? []) { ... }
}
// Same pattern for serial batches — run both IMEI and serial Promise.all in parallel too:
const [imeiResults, serialResults] = await Promise.all([imeiChunksPromise, serialChunksPromise]);
```

**Expected speedup**: 7 sequential round-trips at 80 ms each ≈ 560 ms → parallel ≈ 80–160 ms.

---

### 1C — Extend Realtime Invalidation for the Identifier Map

When a sale is placed or inventory is updated, the in-memory map must be invalidated so the next
lookup reflects the new state. The `useRealtimeInvalidation` hook already tracks
`inventoryIdentifiersVersion`. Add one line to invalidate the map cache key.

**File**: `src/hooks/use-realtime-invalidation.ts`

```ts
// In the inventoryIdentifiersVersion useEffect (already exists):
useEffect(() => {
  if (inventoryIdentifiersVersion === initialRef.current.identifiers) return;
  queryClient.invalidateQueries({ queryKey: queryKeys.identifiersList });
  // ADD THIS LINE:
  if (companyId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.identifierMapAll(companyId) });
  }
}, [inventoryIdentifiersVersion, companyId, queryClient]);
```

This means the map is always fresh after any sale, stock change, or upload — with zero extra DB
polling.

---

## Tier 2 — Do These Later (Bigger Payoff, More Work)

### 2A — Single JOIN RPC to Replace 3-Query Lookup

Even with the identifier map, `lookupIdentifierByImei` is still called in some paths (e.g. when the
map is not yet hydrated on first load). Replace the 3 sequential queries with a single Postgres
function that returns everything in one round-trip.

**New migration** (`040_fn_lookup_identifier.sql`):

```sql
CREATE OR REPLACE FUNCTION public.lookup_identifier_for_company(
  p_company_id uuid,
  p_imei       text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_ident  record;
  v_inv    record;
  v_colors text;
BEGIN
  SELECT id, inventory_id, imei, serial_number, status, sold_at, color
    INTO v_ident
    FROM public.inventory_identifiers
   WHERE company_id = p_company_id
     AND imei = trim(p_imei)
   LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_inv
    FROM public.inventory
   WHERE id = v_ident.inventory_id
     AND company_id = p_company_id;

  SELECT string_agg(color, ', ' ORDER BY color)
    INTO v_colors
    FROM public.inventory_colors
   WHERE inventory_id = v_ident.inventory_id;

  RETURN jsonb_build_object(
    'identifier', row_to_json(v_ident),
    'inventory',  row_to_json(v_inv),
    'colors',     coalesce(v_ident.color, v_colors)
  );
END;
$$;
```

**Client usage**:

```ts
const { data } = await supabase.rpc("lookup_identifier_for_company", {
  p_company_id: companyId,
  p_imei: imei,
});
```

This reduces cold-path lookup from ~300–600 ms (3 sequential) to ~50–80 ms (1 RPC).

---

### 2B — Partial Index for In-Stock Lookups

The current schema has no index optimised for the hot lookup path
(`company_id + imei WHERE status = 'in_stock'`). Migration 039 added a full unique index on
`(company_id, imei)` which covers uniqueness. For read speed, add a covering partial index:

**New migration** (`041_idx_identifier_active_lookup.sql`):

```sql
-- Covers the hot path: lookup by IMEI for in_stock/reserved devices only.
-- Smaller index → faster scans than the full unique index.
CREATE INDEX IF NOT EXISTS idx_inv_ident_active_imei_lookup
  ON public.inventory_identifiers (company_id, imei)
  WHERE status IN ('in_stock', 'reserved') AND imei IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inv_ident_active_serial_lookup
  ON public.inventory_identifiers (company_id, serial_number)
  WHERE status IN ('in_stock', 'reserved') AND serial_number IS NOT NULL;
```

---

## Summary: What to Implement and When

| Tier | Change                                   | File(s)                                  | Effort  | Speedup                          |
| ---- | ---------------------------------------- | ---------------------------------------- | ------- | -------------------------------- |
| 1A   | `useIdentifierMap` hook + TanStack cache | `use-identifier-map.ts`, `query-keys.ts` | ~2 h    | lookup: 300 ms → 0 ms            |
| 1B   | `Promise.all` for upload batch queries   | `upload-identifier-validation.ts`        | ~30 min | upload validate: 5× faster       |
| 1C   | Realtime invalidation for map cache      | `use-realtime-invalidation.ts`           | ~10 min | keeps map always fresh           |
| 2A   | `lookup_identifier_for_company` RPC      | `040_fn_lookup_identifier.sql`, query fn | ~2 h    | cold lookup: 600 ms → 80 ms      |
| 2B   | Partial covering indexes                 | `041_idx_identifier_active_lookup.sql`   | ~15 min | DB scan: marginal at small scale |

**Recommended order**: 1C → 1B → 1A → 2A → 2B.
Start with the realtime hook fix (10 min, no risk), then parallelize uploads (30 min, clear win),
then add the identifier map hook (biggest UX win for manual sales).

---

## What NOT to Do

- **Redis / server-side cache**: Overkill. Each company's data is user-specific; a shared Redis cache
  would add complexity without meaningful benefit over TanStack Query's per-session cache.
- **Service Worker cache**: Adds offline complexity and is fragile for auth-gated data.
- **IndexedDB persistence**: Not needed — the fetch is fast enough on mount; persistence introduces
  stale-data risk if a sale is placed in another tab.
- **WebSocket streaming on every keystroke**: The realtime subscription already triggers invalidation;
  no need to push individual identifier deltas.
