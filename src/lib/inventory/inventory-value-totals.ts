import type { InventoryItem } from "@/data/inventory";

export interface InventoryValueTotals {
  totalPurchaseValue: number;
  totalSellingValue: number;
}

/**
 * Dashboard inventory value: sum of batch `purchase_price` per line, and
 * sum of `quantity ×` unit selling price (falls back to `pricePerUnit` when needed).
 * Inactive rows are excluded so totals match on-hand catalog stock.
 */
export const computeInventoryValueTotals = (
  items: readonly InventoryItem[],
): InventoryValueTotals => {
  let totalPurchaseValue = 0;
  let totalSellingValue = 0;

  for (const item of items) {
    if (item.isActive === false) {
      continue;
    }
    totalPurchaseValue += item.purchasePrice ?? 0;
    const unitSelling = item.sellingPrice ?? item.pricePerUnit ?? 0;
    totalSellingValue += item.quantity * unitSelling;
  }

  return { totalPurchaseValue, totalSellingValue };
};
