# Manual sale HST: optional “purchase-base” vs default (selling subtotal)

This document records a **product decision** to explore later with the client. **Default behavior in the app is HST on the selling subtotal** (standard retail-style calculation). **No extra migration** ships until that option is approved and implemented.

---

## Current behavior (default — keep unless client approves change)

- **Manual sale order tax** is:

  \[
  \text{tax_amount} = \text{subtotal} \times \text{tax_rate}
  \]

  where **subtotal** = sum of `(selling price per line × quantity)` from order line items, and **tax_rate** = nominal HST % from the manual sale flow (e.g. `0.13` for 13%).

- **Code**
  - `src/contexts/OrdersContext.tsx` — `createManualOrder`: `taxAmount = round(subtotal * taxRate)`.
  - `src/components/manual-sale/ManualSaleWizard.tsx` — preview: `hstAmount = subtotal * hstRate` (`percentToRate(hstPercent)`).

- **Database**
  - `public.update_manual_sale_order` — after subtotal is computed from JSON items, `tax_amount := round(v_subtotal * v_tax_rate, 2)` (see `supabase/migrations/035_update_manual_sale_order.sql`).

---

## Alternative behavior (“purchase-base” / ITC-aligned dollars)

**Intent:** For each line, charge HST **equal to the input tax (ITC) dollars** on the tax-exclusive purchase base allocated to the units sold, instead of HST on revenue.

Per line (when `purchasePrice`, on-hand `quantity`, and `hst` exist on the inventory snapshot):

\[
\text{line_tax} = \frac{\text{purchasePrice}}{\text{item.quantity}} \times \text{lineQty} \times \frac{\text{HST\%}}{100}
\]

**Fallback** (no purchase base): same as default — `line selling subtotal × nominal tax_rate`.

**Stored `tax_rate` on the order:** Can be the **effective** rate `tax_amount / subtotal` so `subtotal × tax_rate ≈ tax_amount` for reporting (optional).

### Why it was deferred

- Normal GST/HST rules typically tax the **consideration** (what the customer pays), not the supplier’s cost. The alternative matches an **internal** mental model (ITC dollars per unit vs output dollars) and must be **signed off** with the client / accountant for invoices and CRA reporting.

---

## What to add when implementing (no migration files until then)

| Piece               | Notes                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New SQL migration   | `CREATE OR REPLACE` on `public.update_manual_sale_order`: per-line purchase-base tax in the same loop as profit (or equivalent), then set `tax_amount` / optional effective `tax_rate`. Use next sequential name under `supabase/migrations/`. |
| Client helper       | e.g. `src/lib/tax/manual-sale-hst.ts` with `calculateManualSaleLineTax`, `calculateManualSaleOrderTax(items, nominalHstPercent)`.                                                                                                              |
| `createManualOrder` | Replace subtotal×rate with the helper; store `tax_amount` and effective `tax_rate` if desired.                                                                                                                                                 |
| `ManualSaleWizard`  | Draft `OrderItem[]` matching submit; same helper for preview; clear HST labels.                                                                                                                                                                |

---

## Checklist to implement the alternative

1. Confirm with client: invoices, effective rate display, and accountant expectations.
2. Add the migration + TS changes together in one delivery.
3. Ensure DB RPC matches the client helper (same rounding per line).
4. Run HST reconciliation / order PDF / invoice flows for mixed orders.
5. Add a short in-app note if the effective % on subtotal differs from the nominal HST %.

---

## Agent prompt shortcut

> “Implement **manual sale HST purchase-base option** as described in `docs/MANUAL_SALE_HST_PURCHASE_BASE_OPTION.md` (Alternative + Checklist). Add a new additive migration for `update_manual_sale_order` and the client helper; default until then remains selling subtotal × rate.”
