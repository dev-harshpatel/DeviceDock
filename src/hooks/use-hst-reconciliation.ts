"use client";

import { useMemo, useState } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { format } from "date-fns";
import type { PurchaseHSTRow, SalesHSTRow } from "@/types/hst";

export function useHSTReconciliation() {
  const { inventory, isLoading: inventoryLoading } = useInventory();
  const { orders, isLoading: ordersLoading } = useOrders();

  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  });

  const hasActiveFilters = dateRange.from !== null || dateRange.to !== null;
  const isPageLoading = inventoryLoading || ordersLoading;

  // Helper: parse a date string safely
  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Helper: check if a date string falls within the selected range
  const inRange = (dateStr: string | null | undefined): boolean => {
    if (!dateRange.from && !dateRange.to) return true;
    const d = parseDate(dateStr);
    if (!d) return false;
    if (dateRange.from && d < dateRange.from) return false;
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  };

  // ── HST Paid on Purchases (Input Tax Credits) ─────────────────────────────
  const purchaseHSTRows = useMemo<PurchaseHSTRow[]>(() => {
    return inventory
      .filter(
        (item) =>
          item.purchasePrice != null &&
          item.hst != null &&
          item.hst > 0 &&
          inRange(item.lastUpdated),
      )
      .map((item) => ({
        id: item.id,
        deviceName: item.deviceName,
        brand: item.brand,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice!,
        hstRate: item.hst!,
        hstAmount: (item.purchasePrice! * item.hst!) / 100,
        totalWithHST: item.purchasePrice! * (1 + item.hst! / 100),
        date: item.lastUpdated,
      }));
  }, [inventory, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalHSTPaid = useMemo(
    () => purchaseHSTRows.reduce((sum, r) => sum + r.hstAmount, 0),
    [purchaseHSTRows],
  );
  const totalPurchaseBase = useMemo(
    () => purchaseHSTRows.reduce((sum, r) => sum + r.purchasePrice, 0),
    [purchaseHSTRows],
  );

  /** Rows with HST % but no tax-exclusive purchase base cannot produce ITC dollars. */
  const hasMissingPurchaseBaseForItc = useMemo(
    () =>
      inventory.some(
        (item) =>
          item.hst != null &&
          item.hst > 0 &&
          (item.purchasePrice == null || item.purchasePrice <= 0),
      ),
    [inventory],
  );

  // ── HST Collected from Sales (Output Tax) ────────────────────────────────
  const salesHSTRows = useMemo<SalesHSTRow[]>(() => {
    return orders
      .filter(
        (o) =>
          (o.status === "approved" || o.status === "completed") &&
          ((o.taxRate != null && o.taxRate > 0) || (o.taxAmount != null && o.taxAmount > 0)) &&
          inRange(o.createdAt),
      )
      .map((order) => {
        const subtotal = order.subtotal ?? 0;
        const taxRate = order.taxRate ?? 0;
        const hstCollected = order.taxAmount ?? subtotal * taxRate;
        return {
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          subtotal,
          taxRate,
          taxRatePercent: taxRate * 100,
          hstCollected,
          date: order.createdAt,
        };
      });
  }, [orders, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalHSTCollected = useMemo(
    () => salesHSTRows.reduce((sum, r) => sum + r.hstCollected, 0),
    [salesHSTRows],
  );

  const totalSalesSubtotal = useMemo(
    () => salesHSTRows.reduce((sum, r) => sum + r.subtotal, 0),
    [salesHSTRows],
  );

  /** Aggregate ITC % on purchase base (for summary display). */
  const itcEffectivePercent = useMemo(() => {
    if (totalPurchaseBase <= 1e-9) return null;
    return (totalHSTPaid / totalPurchaseBase) * 100;
  }, [totalHSTPaid, totalPurchaseBase]);

  /** Aggregate effective tax % on sales subtotals. */
  const collectedEffectivePercent = useMemo(() => {
    if (totalSalesSubtotal <= 1e-9) return null;
    return (totalHSTCollected / totalSalesSubtotal) * 100;
  }, [totalHSTCollected, totalSalesSubtotal]);

  // Positive = you owe CRA; Negative = CRA owes you a refund
  const netHSTPosition = totalHSTCollected - totalHSTPaid;

  const purchaseRateBreakdown = useMemo(() => {
    const map = new Map<number, { count: number; baseAmount: number; hstAmount: number }>();
    purchaseHSTRows.forEach((r) => {
      const existing = map.get(r.hstRate) ?? { count: 0, baseAmount: 0, hstAmount: 0 };
      existing.count += 1;
      existing.baseAmount += r.purchasePrice;
      existing.hstAmount += r.hstAmount;
      map.set(r.hstRate, existing);
    });
    return Array.from(map.entries())
      .map(([rate, data]) => ({ rate, ...data }))
      .sort((a, b) => b.rate - a.rate);
  }, [purchaseHSTRows]);

  const salesRateBreakdown = useMemo(() => {
    const map = new Map<number, { count: number; subtotal: number; hstAmount: number }>();
    salesHSTRows.forEach((r) => {
      const key = Math.round(r.taxRatePercent * 100) / 100;
      const existing = map.get(key) ?? { count: 0, subtotal: 0, hstAmount: 0 };
      existing.count += 1;
      existing.subtotal += r.subtotal;
      existing.hstAmount += r.hstCollected;
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([rate, data]) => ({ rate, ...data }))
      .sort((a, b) => b.rate - a.rate);
  }, [salesHSTRows]);

  /** Weighted by purchase base when > 0; otherwise simple average of rates (e.g. base missing). */
  const avgPurchaseRate = useMemo(() => {
    if (purchaseRateBreakdown.length === 0) return 13;
    if (totalPurchaseBase > 1e-9) {
      return (
        purchaseRateBreakdown.reduce((sum, r) => sum + r.rate * r.baseAmount, 0) / totalPurchaseBase
      );
    }
    return purchaseRateBreakdown.reduce((sum, r) => sum + r.rate, 0) / purchaseRateBreakdown.length;
  }, [purchaseRateBreakdown, totalPurchaseBase]);

  const rateMismatches = useMemo(
    () => salesHSTRows.filter((r) => r.taxRatePercent > 0 && r.taxRatePercent < avgPurchaseRate),
    [salesHSTRows, avgPurchaseRate],
  );

  /** Sum of “Saving” from Rate Difference Analysis (hypothetical tax at avg purchase rate − collected). */
  const totalRateBenchmarkSaving = useMemo(() => {
    return rateMismatches.reduce((sum, row) => {
      const atAvgPurchaseRate = row.subtotal * (avgPurchaseRate / 100);
      return sum + (atAvgPurchaseRate - row.hstCollected);
    }, 0);
  }, [rateMismatches, avgPurchaseRate]);

  const timelineData = useMemo(() => {
    const byMonth = new Map<string, { hstPaid: number; hstCollected: number }>();
    purchaseHSTRows.forEach((r) => {
      const d = parseDate(r.date);
      if (!d) return;
      const key = format(d, "MMM yyyy");
      const existing = byMonth.get(key) ?? { hstPaid: 0, hstCollected: 0 };
      existing.hstPaid += r.hstAmount;
      byMonth.set(key, existing);
    });
    salesHSTRows.forEach((r) => {
      const d = parseDate(r.date);
      if (!d) return;
      const key = format(d, "MMM yyyy");
      const existing = byMonth.get(key) ?? { hstPaid: 0, hstCollected: 0 };
      existing.hstCollected += r.hstCollected;
      byMonth.set(key, existing);
    });
    return Array.from(byMonth.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => new Date("1 " + a.period).getTime() - new Date("1 " + b.period).getTime());
  }, [purchaseHSTRows, salesHSTRows]);

  return {
    dateRange,
    setDateRange,
    hasActiveFilters,
    isPageLoading,
    purchaseHSTRows,
    totalHSTPaid,
    totalPurchaseBase,
    hasMissingPurchaseBaseForItc,
    salesHSTRows,
    totalHSTCollected,
    totalSalesSubtotal,
    itcEffectivePercent,
    collectedEffectivePercent,
    netHSTPosition,
    purchaseRateBreakdown,
    salesRateBreakdown,
    avgPurchaseRate,
    rateMismatches,
    totalRateBenchmarkSaving,
    timelineData,
  };
}
