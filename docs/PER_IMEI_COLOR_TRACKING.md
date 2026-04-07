# Per-IMEI Color Tracking

## Problem

Currently, colors are tracked as aggregate counts per product SKU in the `inventory_colors` table (e.g., "iPhone 14: Black=12, Blue=13"). Individual IMEI units in `inventory_identifiers` have no color field, so there's no way to know which specific IMEI is which color.

## Goal

Each IMEI/serial unit should have its own color, queryable via IMEI lookup and visible throughout the system.

## Approach: Manual Mapping UI (Option B)

After the user enters IMEIs and assigns a color breakdown, a mapping step lets them assign a specific color to each IMEI unit.

---

## Implementation Steps

### Phase 1: Database Migration

**New migration file:** `supabase/migrations/0XX_add_color_to_inventory_identifiers.sql`

```sql
ALTER TABLE public.inventory_identifiers
  ADD COLUMN color TEXT;

CREATE INDEX idx_inv_identifiers_color
  ON public.inventory_identifiers (inventory_id, color)
  WHERE color IS NOT NULL;
```

- Column is nullable (color assignment is optional, not all units may have it).
- No foreign key to `inventory_colors` — the color is a free-text field matching the color names used in the breakdown.

### Phase 2: Color Mapping UI in Add/Restock Flow

**Where:** After the user has entered both IMEIs (comma-separated) and the color breakdown (e.g., "3 Black, 2 Blue"), show a new mapping step.

**UI Design:**

- A list/table showing each IMEI with a color dropdown next to it.
- The dropdown options come from the color breakdown the user just defined.
- Auto-pre-fill sequentially as a starting point (first 3 IMEIs = Black, next 2 = Blue) so the user only needs to adjust, not fill from scratch.
- Validation: every IMEI must have a color assigned, and the per-color counts must match the breakdown totals.
- This step appears between color assignment and the final "Add to inventory" submission.

**Files to modify:**

- `src/page-components/AddMultipleProducts.tsx` — add mapping step/modal
- New component: `src/components/modals/ImeiColorMappingDialog.tsx` or inline in the form

### Phase 3: Save Color on Identifier

**Where:** The submit flow in `AddMultipleProducts.tsx`

Currently, `addInventoryIdentifier(inventoryId, imei, serial)` inserts into `inventory_identifiers` without a color. Update to accept an optional `color` parameter and write it to the new column.

**Files to modify:**

- `src/contexts/InventoryContext.tsx` — update `addInventoryIdentifier` to accept `color?: string`
- `src/page-components/AddMultipleProducts.tsx` — pass the mapped color when inserting each identifier

### Phase 4: Update IMEI Lookup

**Where:** `src/lib/supabase/queries/inventory.ts` → `lookupIdentifierByImei()`

Read `color` directly from the `inventory_identifiers` row instead of joining `inventory_colors`. The query already selects from this table — just add `color` to the select fields.

**Files to modify:**

- `src/lib/supabase/queries/inventory.ts` — add `color` to the select in `lookupIdentifierByImei()`
- The `IdentifierFullLookup` type already has a `color` field

### Phase 5: Keep `inventory_colors` in Sync

The aggregate `inventory_colors` table is still useful for the product management view (showing color breakdown without counting individual rows). No changes needed to that table — it continues to work as-is. The per-identifier color is an additional data point, not a replacement.

**Optional future enhancement:** Derive `inventory_colors` counts from `inventory_identifiers` grouped by color, eliminating the need for a separate aggregate table. This is not required for the initial implementation.

### Phase 6: Product Management / Edit Products

When editing colors in product management, if per-IMEI colors exist, show which IMEIs have which color and allow reassignment. This is a follow-up enhancement, not required for the initial implementation.

---

## Files Summary

| File                                                             | Action                                              |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| `supabase/migrations/0XX_add_color_to_inventory_identifiers.sql` | Create — add `color` column                         |
| `src/components/modals/ImeiColorMappingDialog.tsx`               | Create — mapping UI                                 |
| `src/page-components/AddMultipleProducts.tsx`                    | Modify — add mapping step, pass color on insert     |
| `src/contexts/InventoryContext.tsx`                              | Modify — update `addInventoryIdentifier` signature  |
| `src/lib/supabase/queries/inventory.ts`                          | Modify — read color from identifier row             |
| `src/types/inventory-identifiers.ts`                             | Already has `color` field on `IdentifierFullLookup` |

## Risks and Considerations

- **Existing data:** Existing IMEI units will have `color = NULL`. The UI should handle this gracefully (show "—" or "Not assigned").
- **Color name consistency:** The mapping dropdown uses colors from the breakdown, which already exist in `inventory_colors`. Case sensitivity is handled by the dropdown (no free-text entry during mapping).
- **Bulk operations:** For large batches (50+ units), the mapping UI needs to be performant. Consider a virtualized list if needed.
- **Backward compatibility:** The `color` column is nullable, so all existing queries and flows continue to work without changes.
