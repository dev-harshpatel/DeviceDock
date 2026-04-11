# Additional Costs (Repair/Refurbishment Tracking)

## Problem

When purchasing bulk inventory (e.g., 50 iPhone 14s), some units may arrive with defects — dead batteries, cracked screens, faulty charging ports, etc. These units can't be sold as-is. We need to repair them at an additional cost before they're sellable.

Today, there's no way to record these repair costs. This means:

- The true cost basis of inventory is understated
- Profit calculations are wrong (repair costs are invisible)
- There's no audit trail of what repairs were done on which batch

**Goal:** Track additional costs per inventory item, update the average cost per unit accordingly, and display this in a dedicated tab.

---

## Real-World Example

| Step | Event                                 | Purchase Price | Additional Costs      | Effective Cost | Qty | Avg/Unit (no HST) |
| ---- | ------------------------------------- | -------------- | --------------------- | -------------- | --- | ----------------- |
| 1    | Buy 50 iPhone 14s                     | $25,000        | $0                    | $25,000        | 50  | $500.00           |
| 2    | Replace battery on 5 units @ $50 each | $25,000        | $250                  | $25,250        | 50  | $505.00           |
| 3    | Replace screen on 2 units @ $120 each | $25,000        | $490                  | $25,490        | 50  | $509.80           |
| 4    | Sell 10 units                         | $20,196\*      | $490 stays in records | —              | 40  | still $509.80\*\* |

\* purchase_price scales proportionally on sale (existing behavior): `25,000 * 40/50 = 20,000`. But see "Quantity Decrease" section below for how additional costs interact with this.

\*\* Average stays the same because both purchase_price and additional costs absorb the sale proportionally.

---

## Data Model

### New Table: `additional_costs`

```sql
CREATE TABLE additional_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inventory_id    UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,

  -- What was done
  cost_type       TEXT NOT NULL,          -- 'battery_replacement', 'screen_repair', 'housing_swap', 'other'
  description     TEXT,                   -- Free-text notes, e.g., "Replaced with OEM battery"

  -- Cost breakdown
  units_affected  INTEGER NOT NULL DEFAULT 1,  -- How many units needed this repair
  cost_per_unit   NUMERIC(10,2) NOT NULL,      -- Pre-tax cost per unit for this repair
  tax_amount      NUMERIC(10,2) DEFAULT 0,     -- HST/tax paid on the repair (for record-keeping)
  total_cost      NUMERIC(10,2) NOT NULL,      -- units_affected * cost_per_unit (pre-tax, this is what affects pricing)

  -- Optional: link to specific tracked units
  identifier_ids  UUID[],                -- References to inventory_identifiers (optional, only if IMEI-tracked)

  -- Metadata
  vendor          TEXT,                   -- Who did the repair? "Mobile Fix Shop", "In-house", etc.
  receipt_ref     TEXT,                   -- Receipt/invoice number for the repair
  cost_date       DATE DEFAULT CURRENT_DATE,   -- When the repair was done
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id)
);

-- RLS: company-scoped access
ALTER TABLE additional_costs ENABLE ROW LEVEL SECURITY;
```

### Inventory Table Changes

Add one new column to `inventory`:

```sql
ALTER TABLE inventory ADD COLUMN total_additional_costs NUMERIC(10,2) DEFAULT 0;
```

This is a **denormalized summary** kept in sync when additional costs are added/removed. It avoids a JOIN or subquery every time we calculate pricing.

---

## Pricing Formula Update

### Current

```
pricePerUnit = (purchasePrice / quantity) * (1 + hst / 100)
pricePerUnitWithoutTax = purchasePrice / quantity
```

### New

```
effectiveCost = purchasePrice + totalAdditionalCosts
pricePerUnitWithoutTax = effectiveCost / quantity
pricePerUnit = pricePerUnitWithoutTax * (1 + hst / 100)
```

Only one function needs to change: `calculatePricePerUnit()` in `src/data/inventory.ts`.

```ts
// Before
export function calculatePricePerUnit(
  purchasePrice: number,
  quantity: number,
  hst: number,
): number {
  if (quantity === 0) return 0;
  return Math.round((purchasePrice / quantity) * (1 + hst / 100) * 100) / 100;
}

// After
export function calculatePricePerUnit(
  purchasePrice: number,
  quantity: number,
  hst: number,
  totalAdditionalCosts: number = 0, // backward compatible default
): number {
  if (quantity === 0) return 0;
  const effectiveCost = purchasePrice + totalAdditionalCosts;
  return Math.round((effectiveCost / quantity) * (1 + hst / 100) * 100) / 100;
}
```

### Display Impact

In `InventoryTable.tsx`, the "Price/Unit (Without Tax)" column currently shows:

```ts
const getPricePerUnitWithoutTax = (item: InventoryItem): number => {
  if (item.quantity > 0 && item.purchasePrice != null) {
    return item.purchasePrice / item.quantity;
  }
  ...
};
```

This becomes:

```ts
const getPricePerUnitWithoutTax = (item: InventoryItem): number => {
  if (item.quantity > 0 && item.purchasePrice != null) {
    const effectiveCost = item.purchasePrice + (item.totalAdditionalCosts ?? 0);
    return effectiveCost / item.quantity;
  }
  ...
};
```

---

## Edge Cases & Decisions

### 1. Quantity Decrease After Additional Costs

**Scenario:** 50 units, $25,000 purchase + $250 additional costs. Sell 10 units.

**Current behavior:** `purchase_price` scales: `25,000 * 40/50 = 20,000`.

**Question:** Should `total_additional_costs` also scale?

**Decision: NO — additional costs stay fixed.** Here's why:

- Additional costs are sunk repair costs. They don't "leave" when you sell a unit.
- The individual cost records should remain intact for audit purposes.
- The average cost per unit naturally recalculates: `(20,000 + 250) / 40 = $506.25` (slightly higher than the original $505 because the repair cost is now spread over fewer units).
- This is actually correct accounting — the repair cost is absorbed by the remaining units.

**Alternative considered:** Scale additional costs proportionally too. Rejected because it breaks audit trail and is accounting-incorrect.

### 2. Quantity Reaches Zero

When all units are sold, `purchase_price` becomes 0 (existing behavior). `total_additional_costs` stays as-is for historical reference. `pricePerUnit` returns 0 (guarded by `quantity === 0` check).

### 3. Restocking / Weighted Average Merge

**Scenario:** You have 40 remaining units with $250 in additional costs. You restock 20 more of the same item (weighted average merge).

**Decision:** On merge, `total_additional_costs` carries forward unchanged. The new purchase price merges via weighted average (existing behavior), and the additional costs continue to add on top. This is correct — the new batch didn't need repairs.

### 4. Deleting an Additional Cost Entry

When a cost entry is deleted:

- Remove the record from `additional_costs` table
- Subtract `total_cost` from `inventory.total_additional_costs`
- Recalculate `price_per_unit` with the updated effective cost

### 5. Editing an Additional Cost Entry

When edited:

- Compute the delta: `newTotalCost - oldTotalCost`
- Apply delta to `inventory.total_additional_costs`
- Recalculate `price_per_unit`

### 6. Tax on Repairs (HST Handling)

The `tax_amount` field on additional costs is **for record-keeping only** — it tracks how much HST you paid on the repair bill. But it does NOT feed into the inventory HST calculation.

Why? The inventory `hst` field represents the sales tax rate on the original purchase. Repair costs are a separate expense. The pre-tax repair cost (`total_cost`) goes into the cost basis. The tax you paid on the repair is a business expense (potentially claimable as input tax credit) but isn't part of the inventory's HST rate.

### 7. No IMEI Tracking on Item

Additional costs work regardless of whether the item has IMEI/serial tracking. The `identifier_ids` field is optional — it's a nice-to-have for linking repairs to specific units, but the cost tracking works at the batch level.

### 8. Profit Calculation Impact

Current profit formula: `profit = (sellingPrice - costPerUnit) * quantity`

Where `costPerUnit = pricePerUnit` (includes HST). With additional costs baked into `pricePerUnit`, profit calculations automatically become accurate with no changes needed to the order/profit logic.

### 9. Multiple Cost Types on Same Units

Allowed. A unit can have battery replaced AND screen repaired. Each is a separate entry. They all sum into `total_additional_costs`.

---

## Predefined Cost Types

Start with these, allow "Other" with free text:

| Key                   | Label                | Common for            |
| --------------------- | -------------------- | --------------------- |
| `battery_replacement` | Battery Replacement  | Dead/degraded battery |
| `screen_repair`       | Screen Repair        | Cracked/dead screen   |
| `charging_port`       | Charging Port Repair | Faulty charging       |
| `housing_swap`        | Housing/Back Glass   | Cosmetic damage       |
| `motherboard_repair`  | Motherboard Repair   | Logic board issues    |
| `software_flash`      | Software Flash/Reset | Software issues       |
| `other`               | Other                | Free-text description |

---

## UI Design

### Where It Lives

On the **Product Management** page (`src/page-components/ProductManagement.tsx`), each inventory row gets a new action button: **"Additional Costs"** (wrench icon or dollar-plus icon).

Clicking it opens a **Sheet (slide-over panel)** from the right side, showing:

### Additional Costs Sheet Layout

```
┌─────────────────────────────────────────────────┐
│  Additional Costs — iPhone 14, 128GB, Grade A   │
│                                                  │
│  Summary Bar                                     │
│  ┌────────────────┐  ┌────────────────────────┐  │
│  │ Total: $490.00 │  │ Avg Impact: +$9.80/unit│  │
│  └────────────────┘  └────────────────────────┘  │
│                                                  │
│  [+ Add Cost]                                    │
│                                                  │
│  ┌─ Cost Entry ──────────────────────────────┐   │
│  │ Battery Replacement         $250.00       │   │
│  │ 5 units @ $50.00/unit                     │   │
│  │ Vendor: Mobile Fix Shop  |  Jan 15, 2026  │   │
│  │ Receipt: INV-2026-0042                    │   │
│  │                          [Edit] [Delete]  │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌─ Cost Entry ──────────────────────────────┐   │
│  │ Screen Repair               $240.00       │   │
│  │ 2 units @ $120.00/unit                    │   │
│  │ Vendor: In-house         |  Jan 18, 2026  │   │
│  │                          [Edit] [Delete]  │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Add/Edit Cost Dialog

A small dialog within the sheet:

```
┌─ Add Additional Cost ─────────────────────┐
│                                            │
│  Cost Type:     [Battery Replacement  v]   │
│  Description:   [Replaced with OEM bat...] │
│  Units Affected: [5]                       │
│  Cost Per Unit:  [$50.00]                  │
│  Tax Paid:       [$32.50]    (optional)    │
│                                            │
│  Total Cost:     $250.00  (auto-calc)      │
│                                            │
│  Vendor:        [Mobile Fix Shop]          │
│  Receipt #:     [INV-2026-0042]            │
│  Date:          [2026-01-15]               │
│                                            │
│           [Cancel]  [Save Cost]            │
└────────────────────────────────────────────┘
```

### Inventory Table Indicator

In the main InventoryTable, add a small visual indicator for items that have additional costs — a small badge or icon next to the device name showing something like a wrench icon with the total additional cost on hover tooltip.

### Product Management Table

Add a column or inline indicator showing `total_additional_costs` so managers can see at a glance which items have repair costs baked in.

---

## Implementation Phases

### Phase 1: Schema + Data Layer

1. Create migration: `additional_costs` table + `total_additional_costs` column on inventory
2. Add TypeScript types for `AdditionalCost` in `src/types/`
3. Add Supabase query functions in `src/lib/supabase/queries/additional-costs.ts`
4. Add mapper functions in `mappers.ts`
5. Update `InventoryItem` type to include `totalAdditionalCosts`
6. Update inventory mapper to include new field

### Phase 2: Pricing Logic Update

1. Update `calculatePricePerUnit()` to accept `totalAdditionalCosts`
2. Update `getPricePerUnitWithoutTax()` in InventoryTable
3. Update any other places that compute cost-per-unit
4. Verify profit calculation still works correctly

### Phase 3: UI — Additional Costs Sheet

1. Create `AdditionalCostsSheet` component in `src/components/sheets/`
2. Create `AddCostDialog` component in `src/components/modals/`
3. Wire into ProductManagement page with action button
4. Include summary bar, cost entries list, add/edit/delete flows
5. On add/edit/delete: update `inventory.total_additional_costs` + recalc `price_per_unit`

### Phase 4: UI Polish + Indicators

1. Add cost indicator badge in InventoryTable
2. Add `total_additional_costs` display in ProductManagement
3. Mobile-responsive card view for cost entries
4. Toast messages for all actions

---

## Files That Will Change

| File                                                | Change                                                 |
| --------------------------------------------------- | ------------------------------------------------------ |
| `supabase/migrations/0XX_additional_costs.sql`      | New migration                                          |
| `src/lib/database.types.ts`                         | Regenerate or manually add types                       |
| `src/types/additional-cost.ts`                      | **New** — AdditionalCost interface                     |
| `src/data/inventory.ts`                             | Update `InventoryItem`, update `calculatePricePerUnit` |
| `src/lib/supabase/queries/additional-costs.ts`      | **New** — CRUD queries                                 |
| `src/lib/supabase/queries/mappers.ts`               | Add additional cost mapper, update inventory mapper    |
| `src/lib/supabase/queries/inventory.ts`             | Include `total_additional_costs` in selects            |
| `src/contexts/InventoryContext.tsx`                 | Add methods for additional cost CRUD + pricing recalc  |
| `src/components/sheets/AdditionalCostsSheet.tsx`    | **New** — main UI panel                                |
| `src/components/modals/AddAdditionalCostDialog.tsx` | **New** — add/edit form                                |
| `src/components/tables/InventoryTable.tsx`          | Update cost display, add indicator                     |
| `src/page-components/ProductManagement.tsx`         | Add action button, wire sheet                          |
| `src/lib/constants/toast-messages.ts`               | Add cost-related messages                              |
| `src/lib/constants/index.ts`                        | Add COST_TYPES constant                                |

---

## Open Questions (For Your Review)

1. **Should additional costs scale on quantity decrease?** Current recommendation: No. The repair cost is a sunk cost on the batch. As you sell units, the remaining units absorb a slightly higher share. This is standard inventory accounting. Do you agree?

2. **Do you want to track which specific units (by IMEI) were repaired?** The plan supports optional linking to `inventory_identifiers`, but it's not required. Worth implementing in Phase 1 or defer?

3. **Should we show the "effective cost breakdown" on the inventory table?** e.g., a tooltip or expandable row showing "Base: $500 + Repairs: $9.80 = $509.80/unit". Or keep it simple with just the final number?

4. **Repair vendor directory?** Start simple with a free-text vendor field, or build a reusable vendor dropdown from historical entries?

5. **Any other cost types** you commonly deal with beyond the ones listed?
