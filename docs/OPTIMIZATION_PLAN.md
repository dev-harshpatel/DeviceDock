# DeviceDock — Optimization Plan

**Status:** In Progress | **Created:** 2026-04-14  
**Scope:** DB query efficiency, TanStack Query adoption, component modularity, code duplication  
**Goal:** Implement in phases; each phase is shippable and independently reviewable.

---

## Overview

The codebase is well-structured with good existing patterns (mappers, query factories, realtime invalidation, paginated hooks). The main inefficiencies are:

1. Three contexts fetch data manually via `useEffect` + raw Supabase instead of TanStack Query
2. Dashboard stats run 6 independent DB queries where 1–2 aggregated queries would suffice
3. Several components exceed 1,000 lines and mix data-fetching, state, and rendering concerns
4. A handful of `useEffect`-based fetches bypass the query cache entirely
5. Minor duplication in tax math, date formatting, and toast error patterns

Each phase below is self-contained with clear entry/exit criteria.

---

## Phases at a Glance

| Phase | Theme                                                     | Risk   | Effort | Status  |
| ----- | --------------------------------------------------------- | ------ | ------ | ------- |
| 1     | Query layer — Stats aggregation                           | Low    | Low    | ✅ Done |
| 2     | Replace context data-fetching with TanStack Query         | Medium | High   | ✅ Done |
| 3     | Missing `useQuery` adoption (notifications, emails, etc.) | Low    | Low    | ✅ Done |
| 4     | Component decomposition — Modals                          | Low    | Medium | —       |
| 5     | Component decomposition — Page components                 | Low    | High   | —       |
| 6     | Code deduplication & utilities                            | Low    | Low    | ✅ Done |
| 7     | Bundle & loading performance                              | Low    | Medium | ✅ Done |

---

## Phase 1 — Dashboard Stats: Eliminate Redundant DB Queries

**Why first:** Zero UI changes. Pure backend / query improvement. High ROI for low risk.

### Problem

`fetchInventoryStats()` runs 2 sequential queries and performs aggregation in JavaScript:

- Query 1: `SELECT id, quantity, selling_price` → iterates rows in JS to sum totals and count
- Query 2: `SELECT id WHERE quantity <= 10` → counts low-stock items

`fetchOrderStats()` runs 4 separate queries:

- Count all orders
- Count pending orders
- Count completed orders
- SELECT total_price to sum revenue in JS

**Total: 6 queries per Dashboard page load.** All could be 2 or even 1 query.

### Solution

#### 1a. Create SQL RPC functions in a new migration

**File:** `supabase/migrations/046_stats_rpc_functions.sql`

```sql
-- Inventory stats in a single aggregated query
CREATE OR REPLACE FUNCTION get_inventory_stats(p_company_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_items',        COUNT(*),
    'total_units',        COALESCE(SUM(quantity), 0),
    'total_value',        COALESCE(SUM(quantity * selling_price), 0),
    'low_stock_count',    COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= 10),
    'out_of_stock_count', COUNT(*) FILTER (WHERE quantity = 0)
  )
  FROM inventory
  WHERE company_id = p_company_id;
$$ LANGUAGE sql STABLE;

-- Order stats in a single aggregated query
CREATE OR REPLACE FUNCTION get_order_stats(p_company_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_orders',     COUNT(*),
    'pending_orders',   COUNT(*) FILTER (WHERE status = 'pending'),
    'completed_orders', COUNT(*) FILTER (WHERE status = 'completed'),
    'total_revenue',    COALESCE(SUM(total_price) FILTER (WHERE status = 'completed'), 0)
  )
  FROM orders
  WHERE company_id = p_company_id AND deleted_at IS NULL;
$$ LANGUAGE sql STABLE;
```

#### 1b. Update `src/lib/supabase/queries/stats.ts`

Replace the multi-query implementations with single RPC calls:

```typescript
// Before: 2 queries + JS aggregation
export async function fetchInventoryStats(companyId: string) {
  const { data: items } = await supabase.from("inventory").select("id, quantity, selling_price")...
  const { count } = await supabase.from("inventory").select("id", { count: "exact" })...
}

// After: 1 RPC call
export async function fetchInventoryStats(companyId: string): Promise<InventoryStats> {
  const { data, error } = await supabase.rpc("get_inventory_stats", { p_company_id: companyId });
  if (error) throw error;
  return data as InventoryStats;
}
```

#### 1c. Add `staleTime` to Dashboard stat queries

In `src/page-components/Dashboard.tsx`, replace the `Promise.all` in `useEffect` with two `useQuery` calls:

```typescript
const { data: inventoryStats } = useQuery({
  queryKey: queryKeys.inventoryStats(companyId),
  queryFn: () => fetchInventoryStats(companyId),
  staleTime: 5 * 60_000, // stats are fine to cache for 5 minutes
});

const { data: orderStats } = useQuery({
  queryKey: queryKeys.orderStats(companyId),
  queryFn: () => fetchOrderStats(companyId),
  staleTime: 5 * 60_000,
});
```

#### 1d. Add query keys to `src/lib/query-keys.ts`

```typescript
inventoryStats: (companyId: string) => ["inventoryStats", companyId],
orderStats:     (companyId: string) => ["orderStats",     companyId],
```

### Exit Criteria

- [x] Migration applied and functions working in Supabase
- [x] Dashboard shows same numbers as before
- [x] Network tab shows 2 requests instead of 6 on Dashboard load
- [x] Stats cache for 5 min (verify no re-fetch on navigation back to dashboard within 5 min)

---

## Phase 2 — Replace Context Data-Fetching with TanStack Query

**Why:** `InventoryContext` (550 lines) and `OrdersContext` (720 lines) both manually fetch data via `useEffect`. This bypasses the query cache, making it impossible to deduplicate requests, set per-component `staleTime`, or benefit from background refetch.

### Problem Detail

```typescript
// Current InventoryContext pattern (❌ bypasses cache)
useEffect(() => {
  loadInventory(); // calls supabase.from("inventory").select(...)
}, [inventoryVersion]);

// Current OrdersContext pattern (❌ same issue)
useEffect(() => {
  loadOrders();
}, [ordersVersion]);
```

### Solution: Keep contexts for actions only; fetch data with hooks

The contexts should remain (they hold mutation actions like `addInventoryItem`, `updateOrder`, etc.) but **should not fetch data themselves**. Data fetching moves to dedicated hooks that use TanStack Query.

#### 2a. Create `src/hooks/use-inventory-query.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchPaginatedInventory } from "@/lib/supabase/queries/inventory";
import { useCompany } from "@/contexts/CompanyContext";

export function useInventoryQuery(filters: InventoryFilters, page: number) {
  const { company } = useCompany();
  return useQuery({
    queryKey: queryKeys.inventoryPage(page, filters),
    queryFn: () => fetchPaginatedInventory({ companyId: company.id, filters, page }),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    keepPreviousData: true,
  });
}
```

#### 2b. Create `src/hooks/use-orders-query.ts`

Same pattern as above for orders pagination.

#### 2c. Slim down `InventoryContext`

Remove the fetch logic from `InventoryContext`. Keep only:

- Optimistic state for local mutations (add, update, delete)
- Action functions that call Supabase and then `queryClient.invalidateQueries()`

Before:

```typescript
// InventoryContext: 550 lines including loading state, error state, fetch, retry
const [inventory, setInventory] = useState<InventoryItem[]>([]);
const [isLoading, setIsLoading] = useState(false);
const loadInventory = async () => { ... supabase calls ... };
```

After:

```typescript
// InventoryContext: ~150 lines — actions only
export const InventoryProvider = ({ children }) => {
  const queryClient = useQueryClient();

  const addItem = async (item: NewInventoryItem) => {
    await supabase.from("inventory").insert(toInventoryInsert(item));
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory() });
  };

  const updateItem = async (id: string, patch: Partial<InventoryItem>) => { ... };
  const deleteItem = async (id: string) => { ... };

  return <InventoryContext.Provider value={{ addItem, updateItem, deleteItem }}>
    {children}
  </InventoryContext.Provider>;
};
```

#### 2d. Slim down `OrdersContext`

Same pattern as 2c for orders. Keep only mutation actions (createOrder, updateOrderStatus, deleteOrder). Remove all useEffect-based loading.

#### 2e. Migration of consuming components

All components that currently call `const { inventory, isLoading } = useInventory()` need to switch to:

```typescript
const { data, isLoading } = useInventoryQuery(filters, page);
const { addItem, updateItem } = useInventory(); // actions only
```

**Components to update:**

- `src/page-components/Inventory.tsx`
- `src/page-components/Orders.tsx`
- `src/page-components/ProductManagement.tsx`
- `src/components/manual-sale/ManualSaleWizard.tsx`
- `src/components/modals/AddProductModal.tsx`
- `src/components/modals/OrderDetailsModal.tsx`
- Any other component using `useInventory()` or `useOrders()` for data

**Sub-phases to avoid a big-bang merge:**

- **2A:** Slim InventoryContext + create hook + update Inventory page only
- **2B:** Update ProductManagement + AddProductModal
- **2C:** Slim OrdersContext + create hook + update Orders page only
- **2D:** Update OrderDetailsModal + ManualSaleWizard

### Exit Criteria

- [x] InventoryContext data fetch replaced with `useQuery` (context exposes same interface)
- [x] OrdersContext data fetch replaced with `useQuery` (context exposes same interface)
- [x] All data reads go through TanStack Query cache (`inventoryAll` / `ordersAll` keys)
- [x] Realtime invalidation centralised in `use-realtime-invalidation.ts` for all key families
- [x] Mutations use `setQueryData` for instant cache update + `invalidateQueries` for sync
- [x] Zero TypeScript errors across all changed files

---

## Phase 3 — Remaining `useEffect` Fetches → `useQuery`

Three remaining manual fetches that bypass the cache.

### 3a. Notifications feed — `src/hooks/use-notifications-feed.ts`

**Current:** Fetches notification events in plain `useEffect` with `supabase.from().select()`.  
**Fix:** Wrap in `useQuery`:

```typescript
// Before
useEffect(() => {
  const fetchFeed = async () => {
    const { data } = await supabase.from("notification_events")...
    setFeed(data);
  };
  fetchFeed();
}, [companyId]);

// After
const { data: feed = [] } = useQuery({
  queryKey: queryKeys.notificationsFeed(companyId),
  queryFn:  () => fetchNotificationEvents(companyId),
  staleTime: 0,           // real-time invalidated anyway
  gcTime:    60_000,
});
```

Move the Supabase query into `src/lib/supabase/queries/notifications.ts`.

### 3b. User emails in Orders — `src/page-components/Orders.tsx`

**Current:** `fetchUserEmails()` is a manual async function called in `useEffect`.  
**Fix:**

```typescript
const { data: userEmails = {} } = useQuery({
  queryKey: queryKeys.userEmails(userIds),
  queryFn: () =>
    fetch("/api/users/emails", { method: "POST", body: JSON.stringify({ userIds }) }).then((r) =>
      r.json(),
    ),
  staleTime: Infinity, // email addresses don't change per session
  enabled: userIds.length > 0,
});
```

### 3c. Dashboard stats (if not done in Phase 1)

Already described in Phase 1.

### Exit Criteria

- [ ] Zero `useEffect(() => { supabase.from(...)... }, [...])` patterns outside of contexts and realtime
- [ ] Notifications load from query cache on tab revisit
- [ ] Email fetch deduplicated when Orders component remounts

---

## Phase 4 — Component Decomposition: Modals ✅ Done

Break the two largest modal components. No behavior changes — pure extraction.

### 4a. `AddProductModal` (1,784 lines) → 5 focused components

**File:** `src/components/modals/AddProductModal.tsx`

Extract into:

| New File                                                       | Responsibility                                | Est. Lines |
| -------------------------------------------------------------- | --------------------------------------------- | ---------- |
| `src/components/modals/add-product/DeviceSelector.tsx`         | Brand / model / variant dropdowns with search | ~150       |
| `src/components/modals/add-product/GradeConditionSelector.tsx` | Grade, color, storage selectors               | ~120       |
| `src/components/modals/add-product/PriceInputs.tsx`            | purchase price, selling price, HST toggle     | ~100       |
| `src/components/modals/add-product/InventoryMetaFields.tsx`    | SKU, IMEI fields, quantity                    | ~80        |
| `src/components/modals/add-product/ProductFormSummary.tsx`     | Review section before save                    | ~80        |
| `src/components/modals/AddProductModal.tsx` (shell)            | State + orchestration only                    | ~250       |

**Pattern for each sub-component:**

```typescript
interface DeviceSelectorProps {
  value: DeviceSelection;
  onChange: (v: DeviceSelection) => void;
  brands: Brand[];
  isLoading?: boolean;
}
export function DeviceSelector({ value, onChange, brands, isLoading }: DeviceSelectorProps) { ... }
```

### 4b. `OrderDetailsModal` (1,153 lines) → 4 focused components

**File:** `src/components/modals/OrderDetailsModal.tsx`

Extract into:

| New File                                                        | Responsibility                                        |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| `src/components/modals/order-details/OrderItemsTable.tsx`       | Line items table with quantities                      |
| `src/components/modals/order-details/OrderStatusActions.tsx`    | Approve / reject / complete buttons + confirm dialogs |
| `src/components/modals/order-details/OrderCustomerInfo.tsx`     | Customer name, address, contact                       |
| `src/components/modals/order-details/OrderFinancialSummary.tsx` | Subtotal, tax, total breakdown                        |
| `OrderDetailsModal.tsx` (shell)                                 | Orchestration + Dialog wrapper only                   |

### 4c. `UserDetailsModal` (751 lines) → 3 focused components

| New File                                                 | Responsibility          |
| -------------------------------------------------------- | ----------------------- |
| `src/components/modals/user-details/UserRoleEditor.tsx`  | Role dropdown + save    |
| `src/components/modals/user-details/UserActivityLog.tsx` | Recent orders / actions |
| `UserDetailsModal.tsx` (shell)                           | Orchestration           |

### Exit Criteria

- [ ] `AddProductModal.tsx` shell under 300 lines
- [ ] `OrderDetailsModal.tsx` shell under 250 lines
- [ ] All extracted sub-components accept pure props (no direct Supabase calls)
- [ ] Existing behavior unchanged; smoke-test add product + order detail flows

---

## Phase 5 — Component Decomposition: Page Components ✅ Done

Break the largest page-level components. Each page component should be under 400 lines.

### 5a. `Reports.tsx` (995 lines)

Extract:

| New Component                                      | Responsibility                    |
| -------------------------------------------------- | --------------------------------- |
| `src/components/reports/ReportsFilterPanel.tsx`    | Date range, status, brand filters |
| `src/components/reports/SalesChartSection.tsx`     | Revenue chart + summary stats     |
| `src/components/reports/InventoryChartSection.tsx` | Stock-level chart                 |
| `src/components/reports/ExportReportsActions.tsx`  | PDF / Excel export buttons        |
| `src/page-components/Reports.tsx` (shell)          | Query calls + layout only         |

### 5b. `HSTReconciliation.tsx` (948 lines)

Extract:

| New Component                                       | Responsibility                 |
| --------------------------------------------------- | ------------------------------ |
| `src/components/hst/HSTFilterBar.tsx`               | Period / status filter         |
| `src/components/hst/HSTReconciliationTable.tsx`     | Table of transactions with HST |
| `src/components/hst/HSTSummaryCard.tsx`             | Total collected / remittable   |
| `src/components/hst/HSTAdjustmentSheet.tsx`         | Adjustment slide-over form     |
| `src/page-components/HSTReconciliation.tsx` (shell) | Orchestration                  |

### 5c. `ProductManagement.tsx` (850 lines)

Extract:

| New Component                                        | Responsibility                         |
| ---------------------------------------------------- | -------------------------------------- |
| `src/components/products/ProductFilterBar.tsx`       | Search + brand + grade filters         |
| `src/components/products/ProductTable.tsx` (desktop) | Already partially exists — consolidate |
| `src/components/products/ProductCard.tsx` (mobile)   | Mobile card view                       |
| `src/components/products/ProductBulkActions.tsx`     | Select all + bulk delete/export        |
| `src/page-components/ProductManagement.tsx` (shell)  | State orchestration                    |

### 5d. `Invoice.tsx` (803 lines)

Extract:

| New Component                                    | Responsibility                   |
| ------------------------------------------------ | -------------------------------- |
| `src/components/invoice/InvoiceForm.tsx`         | Customer/address/line-items form |
| `src/components/invoice/InvoicePreviewPanel.tsx` | PDF preview iframe               |
| `src/components/invoice/InvoiceActionsBar.tsx`   | Download, send, print buttons    |
| `src/page-components/Invoice.tsx` (shell)        | Orchestration                    |

### 5e. `Orders.tsx` (672 lines)

Extract:

| New Component                                | Responsibility                   |
| -------------------------------------------- | -------------------------------- |
| `src/components/orders/ActiveOrdersTab.tsx`  | Active orders table + pagination |
| `src/components/orders/DeletedOrdersTab.tsx` | Deleted orders table             |
| `src/components/orders/OrdersFilterBar.tsx`  | Search + status + date filter    |
| `src/page-components/Orders.tsx` (shell)     | Tab state + query calls          |

### 5f. `UploadProducts.tsx` (654 lines)

Extract:

| New Component                                    | Responsibility                      |
| ------------------------------------------------ | ----------------------------------- |
| `src/components/upload/FileDropZone.tsx`         | Drag-and-drop + file validation     |
| `src/components/upload/UploadPreviewSection.tsx` | Preview table + validation errors   |
| `src/components/upload/UploadActionsBar.tsx`     | Submit / cancel / template download |
| `src/page-components/UploadProducts.tsx` (shell) | Orchestration                       |

### Exit Criteria for Phase 5

- [x] Every page component under 400 lines
- [x] All extracted components accept typed props (no prop drilling > 2 levels)
- [x] Smoke-test each affected page (Reports, HST, Products, Invoice, Orders, Upload)
- [x] Mobile responsive layouts preserved in extracted components

---

## Phase 6 — Code Deduplication & Shared Utilities

### 6a. Centralize tax utilities — `src/lib/tax/calculator.ts`

Several places do tax math inline or inconsistently:

```typescript
// Scattered pattern found in multiple files
const hstAmount = price * (taxRate / 100);
const priceWithHst = price + hstAmount;
const priceExcludingHst = priceInclHst / (1 + taxRate / 100);
```

**Fix:** All tax functions in one file:

```typescript
// src/lib/tax/calculator.ts
export const addTax = (base: number, rate: number) => base * (1 + rate / 100);
export const removeTax = (incl: number, rate: number) => incl / (1 + rate / 100);
export const taxAmount = (base: number, rate: number) => base * (rate / 100);
export const formatTaxRate = (rate: number) => `${rate}%`;
```

### 6b. Standardize toast error handling — `src/lib/utils/toast-helpers.ts`

```typescript
// Before (repeated in ~20 components)
toast.error(error instanceof Error ? error.message : "Something went wrong");

// After — one utility
export function toastError(error: unknown, fallback = TOAST_MESSAGES.GENERIC_ERROR) {
  toast.error(error instanceof Error ? error.message : fallback);
}

export function toastApiError(response: Response, fallback = TOAST_MESSAGES.GENERIC_ERROR) {
  if (!response.ok) toastError(new Error(`HTTP ${response.status}`), fallback);
}
```

### 6c. Date/time formatting — `src/lib/utils/formatters.ts`

Add missing utilities to the existing formatters file:

```typescript
// Time-ago (currently reimplemented in Dashboard and elsewhere)
export function timeAgo(date: Date | string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
```

### 6d. Query key completeness audit

Review `src/lib/query-keys.ts` and ensure every `useQuery` in the codebase uses the factory, not an inline array:

```typescript
// Bad (still exists in some places)
queryKey: [companyId, "inventory", page, JSON.stringify(filters)];

// Good
queryKey: queryKeys.inventoryPage(page, filters);
```

### Exit Criteria

- [ ] Zero inline `price * (taxRate / 100)` patterns outside `src/lib/tax/`
- [ ] `toastError()` used consistently; no raw `toast.error(error.message || ...)` patterns
- [ ] `timeAgo()` in formatters; Dashboard and other uses updated
- [ ] All `useQuery` calls use the `queryKeys` factory

---

## Phase 7 — Bundle & Loading Performance ✅ Done

### 7a. Dynamic imports for large modals

Use Next.js `dynamic()` to code-split modal components that aren't rendered on initial page load:

```typescript
// In Orders page
const OrderDetailsModal = dynamic(() => import("@/components/modals/OrderDetailsModal"), {
  loading: () => null,
});

// In Inventory page
const AddProductModal = dynamic(() => import("@/components/modals/AddProductModal"), {
  loading: () => null,
});
```

**AddProductModal** (1,784 lines) and **OrderDetailsModal** (1,153 lines) together add significant weight to the initial bundle. Since they're only opened on user interaction, lazy loading is ideal.

**Already done well:** `ManualSaleWizard` uses `dynamic()` — replicate this pattern.

### 7b. Adjust global `QueryClient` defaults

In `src/components/providers/Providers.tsx`, tune the defaults:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s default (keep current)
      gcTime: 10 * 60_000, // increase from 5m → 10m
      refetchOnWindowFocus: false, // admin app; overly aggressive currently
      refetchOnReconnect: true, // keep — reconnection is valuable
      retry: 1, // 1 retry (down from default 3)
    },
  },
});
```

`refetchOnWindowFocus: false` prevents a burst of requests when the user alt-tabs back — appropriate for an admin tool.

### 7c. Select only needed fields per query

Audit `fetchPaginatedOrders()` — it currently fetches the full `items` JSON (can be large) for list views that only show order number, customer, status, and total.

Create two variants:

- `fetchOrdersSummary()` — lightweight list (no items JSON)
- `fetchOrderDetail(id)` — full detail including items JSON (called only when modal opens)

```typescript
// Lightweight for table view
const ORDER_SUMMARY_FIELDS =
  "id, order_number, status, total_price, created_at, user_id, customer_name";

// Full for modal
const ORDER_DETAIL_FIELDS = "*, items";
```

### Exit Criteria

- [x] `AddProductModal` and `OrderDetailsModal` loaded lazily (verify in Network tab)
- [x] No refetch spike on window focus in admin panel
- [x] Orders list view transfers less data than before (check Network payload size)

---

## Unchanged — Good Patterns to Preserve

The following are already well-implemented and should not be changed:

- **`usePaginatedReactQuery`** — pagination hook with `keepPreviousData`, correct `staleTime`
- **`use-realtime-invalidation.ts`** — clean invalidation on realtime events
- **`use-filter-options.ts`** — correct `useQuery` with `staleTime: Infinity`
- **`mappers.ts`** — robust DB ↔ TS conversion; do not skip mappers in new queries
- **`applyInventoryFilters()`** — encapsulates filter logic; add similar helper for orders
- **Query key factory** in `query-keys.ts` — extend, never bypass
- **`ManualSaleWizard` dynamic import** — replicate this pattern in Phase 7
- **shadcn/ui component usage** — do not introduce custom alternatives

---

## Implementation Order

```
Phase 1  →  Phase 3  →  Phase 2A  →  Phase 2B  →  Phase 2C  →  Phase 2D
   ↓                                                                  ↓
 Low risk,                                                     Medium risk,
 quick win                                                     big unlock

Phase 4A  →  Phase 4B  →  Phase 4C
   ↓
Phase 5A  →  5B  →  5C  →  5D  →  5E  →  5F
   ↓
Phase 6A  →  6B  →  6C  →  6D
   ↓
Phase 7A  →  7B  →  7C
```

Each sub-phase should be submitted as its own PR for review.

---

## Quick Reference: Files Touched Per Phase

| Phase | Files Created                                                             | Files Modified                                                                        |
| ----- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1     | `migrations/046_stats_rpc_functions.sql`                                  | `lib/query-keys.ts`, `lib/supabase/queries/stats.ts`, `page-components/Dashboard.tsx` |
| 2     | `hooks/use-inventory-query.ts`, `hooks/use-orders-query.ts`               | `contexts/InventoryContext.tsx`, `contexts/OrdersContext.tsx`, all consuming pages    |
| 3     | `lib/supabase/queries/notifications.ts`                                   | `hooks/use-notifications-feed.ts`, `page-components/Orders.tsx`                       |
| 4     | `components/modals/add-product/*`, `components/modals/order-details/*`    | `AddProductModal.tsx`, `OrderDetailsModal.tsx`, `UserDetailsModal.tsx`                |
| 5     | `components/reports/*`, `components/hst/*`, `components/products/*`, etc. | All large page components                                                             |
| 6     | `lib/utils/toast-helpers.ts`                                              | `lib/tax/calculator.ts`, `lib/utils/formatters.ts`, `lib/query-keys.ts`               |
| 7     | —                                                                         | `providers/Providers.tsx`, `lib/supabase/queries/orders.ts`, lazy imports in pages    |
