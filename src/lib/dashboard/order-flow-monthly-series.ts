import { format, parseISO, startOfMonth, subMonths } from "date-fns";

import type { Order } from "@/types/order";

export type MonthlyOrderFlowPoint = {
  /** Short label e.g. Jan, Feb */
  label: string;
  /** yyyy-MM */
  monthKey: string;
  /** Estimated cost of goods from order lines (proportional to batch purchase_price). */
  purchaseFlow: number;
  /** Line selling amount: Σ qty × unit selling price. */
  sellingFlow: number;
};

const MONTHS_BACK = 6;

/**
 * Rolling last N calendar months of order-line flow (not on-hand inventory snapshots).
 * Purchase side uses embedded line items: (purchase_price / max(quantity,1)) × line qty.
 */
export const buildMonthlyOrderFlowSeries = (
  orders: readonly Order[],
  monthsBack: number = MONTHS_BACK,
): MonthlyOrderFlowPoint[] => {
  const now = new Date();
  const points: MonthlyOrderFlowPoint[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = subMonths(startOfMonth(now), i);
    points.push({
      monthKey: format(d, "yyyy-MM"),
      label: format(d, "MMM"),
      purchaseFlow: 0,
      sellingFlow: 0,
    });
  }

  const byKey = new Map(points.map((p) => [p.monthKey, p] as const));

  for (const order of orders) {
    if (order.status === "rejected") continue;

    let created: Date;
    try {
      created = parseISO(order.createdAt);
    } catch {
      continue;
    }
    if (Number.isNaN(created.getTime())) continue;
    const key = format(startOfMonth(created), "yyyy-MM");
    const bucket = byKey.get(key);
    if (!bucket) continue;

    const items = Array.isArray(order.items) ? order.items : [];
    for (const line of items) {
      const item = line.item;
      const qty = line.quantity ?? 0;
      if (qty <= 0) continue;

      const unitSell = item.sellingPrice ?? item.pricePerUnit ?? 0;
      bucket.sellingFlow += qty * unitSell;

      const batchPurchase = item.purchasePrice ?? 0;
      const onHandQty = Math.max(item.quantity ?? 0, 1);
      const unitCost = batchPurchase / onHandQty;
      bucket.purchaseFlow += unitCost * qty;
    }
  }

  return points;
};
