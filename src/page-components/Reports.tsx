"use client";

import { useMemo, useState } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { getStockStatus } from "@/data/inventory";
import { removeTax } from "@/lib/tax";
import { formatPrice } from "@/lib/utils";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminReportsSkeleton } from "@/components/skeletons/AdminReportsSkeleton";
import { format } from "date-fns";
import { GRADES, GRADE_LABELS } from "@/lib/constants/grades";
import { ReportsFilterPanel, type ReportFilters } from "@/components/reports/ReportsFilterPanel";
import { ReportsSummaryCards } from "@/components/reports/ReportsSummaryCards";
import { ReportsChartsGrid } from "@/components/reports/ReportsChartsGrid";

export default function Reports() {
  const { inventory, isLoading: inventoryLoading } = useInventory();
  const { orders, isLoading: ordersLoading } = useOrders();

  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: { from: null, to: null },
    grade: "all",
    brand: "all",
  });

  // Trend chart grouping — derived from the selected date range
  const trendGrouping = useMemo<"day" | "week" | "month">(() => {
    if (!filters.dateRange.from || !filters.dateRange.to) return "month";
    const daysDiff = Math.ceil(
      (filters.dateRange.to.getTime() - filters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysDiff <= 14) return "day";
    if (daysDiff <= 90) return "week";
    return "month";
  }, [filters.dateRange.from, filters.dateRange.to]);

  const availableBrands = useMemo(() => {
    const brands = new Set(inventory.map((item) => item.brand));
    return Array.from(brands).sort();
  }, [inventory]);

  const filteredOrders = useMemo(() => {
    if (!filters.dateRange.from && !filters.dateRange.to) return orders;
    return orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      if (filters.dateRange.from && orderDate < filters.dateRange.from) return false;
      if (filters.dateRange.to) {
        const toDate = new Date(filters.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (orderDate > toDate) return false;
      }
      return true;
    });
  }, [orders, filters.dateRange]);

  const filteredInventory = useMemo(() => {
    let filtered = inventory;
    if (filters.grade !== "all") filtered = filtered.filter((item) => item.grade === filters.grade);
    if (filters.brand !== "all") filtered = filtered.filter((item) => item.brand === filters.brand);
    return filtered;
  }, [inventory, filters.grade, filters.brand]);

  const trendData = useMemo(() => {
    if (filteredOrders.length === 0) return [];
    const ordersByPeriod = new Map<
      string,
      { units: number; value: number; orders: number; sortKey: number }
    >();
    filteredOrders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      let periodKey: string;
      let sortKey: number;
      if (trendGrouping === "day") {
        periodKey = format(orderDate, "MMM dd");
        sortKey = orderDate.setHours(0, 0, 0, 0);
      } else if (trendGrouping === "week") {
        const weekStart = new Date(orderDate);
        weekStart.setDate(orderDate.getDate() - orderDate.getDay());
        weekStart.setHours(0, 0, 0, 0);
        periodKey = format(weekStart, "MMM dd");
        sortKey = weekStart.getTime();
      } else {
        periodKey = format(orderDate, "MMM yyyy");
        sortKey = new Date(orderDate.getFullYear(), orderDate.getMonth(), 1).getTime();
      }
      const existing = ordersByPeriod.get(periodKey) ?? { units: 0, value: 0, orders: 0, sortKey };
      let orderUnits = 0;
      order.items.forEach((item) => {
        orderUnits += item.quantity;
      });
      existing.units += orderUnits;
      existing.value += order.totalPrice;
      existing.orders += 1;
      ordersByPeriod.set(periodKey, existing);
    });
    return Array.from(ordersByPeriod.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [filteredOrders, trendGrouping]);

  const stockByGrade = useMemo(() => {
    return GRADES.map((g) => ({
      name: GRADE_LABELS[g],
      value: filteredInventory.filter((i) => i.grade === g).reduce((s, i) => s + i.quantity, 0),
    })).filter((d) => d.value > 0);
  }, [filteredInventory]);

  const stockByStatus = useMemo(() => {
    const inStock = filteredInventory.filter(
      (i) => getStockStatus(i.quantity) === "in-stock",
    ).length;
    const lowStock = filteredInventory.filter(
      (i) => getStockStatus(i.quantity) === "low-stock",
    ).length;
    const critical = filteredInventory.filter(
      (i) => getStockStatus(i.quantity) === "critical",
    ).length;
    return [
      {
        name: "In Stock",
        value: inStock,
        color: "hsl(142, 76%, 36%)",
        bg: "hsla(142, 76%, 36%, 0.12)",
      },
      {
        name: "Low Stock",
        value: lowStock,
        color: "hsl(38, 92%, 50%)",
        bg: "hsla(38, 92%, 50%, 0.12)",
      },
      {
        name: "Critical",
        value: critical,
        color: "hsl(0, 72%, 51%)",
        bg: "hsla(0, 72%, 51%, 0.12)",
      },
    ];
  }, [filteredInventory]);

  const valueByDevice = useMemo(() => {
    return filteredInventory
      .map((item) => ({
        name: item.deviceName.split(" ").slice(0, 2).join(" "),
        value: item.quantity * item.sellingPrice,
        units: item.quantity,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredInventory]);

  const summaryStats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const totalOrders = filteredOrders.length;
    const totalUnits = filteredOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, item) => s + item.quantity, 0),
      0,
    );
    return { totalRevenue, totalOrders, totalUnits };
  }, [filteredOrders]);

  const getCostPerUnitWithoutHst = (
    purchasePrice: number | null | undefined,
    quantity: number,
    pricePerUnit: number,
    hst: number | null | undefined,
  ): number | null => {
    if (quantity <= 0) return null;
    if (purchasePrice != null) return purchasePrice / quantity;
    if (hst != null && hst > 0) return removeTax(pricePerUnit, hst);
    return pricePerUnit;
  };

  const estimatedProfitStats = useMemo(() => {
    let totalProfit = 0;
    let itemsWithData = 0;
    filteredInventory.forEach((item) => {
      const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
      if (qty <= 0) return;
      const costPerUnit = getCostPerUnitWithoutHst(
        item.purchasePrice,
        item.quantity,
        item.pricePerUnit,
        item.hst,
      );
      if (costPerUnit == null) return;
      const selling = Number.isFinite(item.sellingPrice) ? item.sellingPrice : 0;
      const profitDelta = (selling - costPerUnit) * qty;
      if (Number.isFinite(profitDelta)) {
        totalProfit += profitDelta;
        itemsWithData++;
      }
    });
    return { totalProfit: Number.isFinite(totalProfit) ? totalProfit : 0, itemsWithData };
  }, [filteredInventory]);

  /** Only true while inventory is loading — not when on-hand qty is 0 (sold-out rows skip cost calc). */
  const isEstimatedProfitPending = inventoryLoading;

  const profitFromOrdersStats = useMemo(() => {
    let totalProfit = 0;
    let orderCount = 0;
    filteredOrders.forEach((order) => {
      if (!order.items || !Array.isArray(order.items)) return;
      orderCount++;
      order.items.forEach((orderItem) => {
        const item = orderItem.item;
        const qty = Number.isFinite(orderItem.quantity)
          ? orderItem.quantity
          : (orderItem.quantity ?? 0);
        const selling = (item?.sellingPrice ?? item?.pricePerUnit ?? 0) as number;
        const batchQty = (Number.isFinite(item?.quantity) ? item?.quantity : 1) ?? 1;
        const costPerUnit = getCostPerUnitWithoutHst(
          item?.purchasePrice,
          batchQty,
          item?.pricePerUnit ?? 0,
          item?.hst,
        );
        const cost = costPerUnit ?? ((item?.pricePerUnit ?? 0) as number);
        const profitDelta = (selling - cost) * qty;
        if (Number.isFinite(profitDelta)) totalProfit += profitDelta;
      });
    });
    const hasDateRange = filters.dateRange.from != null && filters.dateRange.to != null;
    let periodLabel = "Profit";
    if (hasDateRange) {
      const daysDiff = Math.ceil(
        (filters.dateRange.to!.getTime() - filters.dateRange.from!.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysDiff <= 1) periodLabel = "Profit (Day)";
      else if (daysDiff <= 7) periodLabel = "Profit (Week)";
      else if (daysDiff <= 31) periodLabel = "Profit (Month)";
      else periodLabel = "Profit (Period)";
    } else {
      periodLabel = "Profit (All time)";
    }
    return { totalProfit: Number.isFinite(totalProfit) ? totalProfit : 0, orderCount, periodLabel };
  }, [filteredOrders, filters.dateRange.from, filters.dateRange.to]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.dateRange.from !== null ||
      filters.dateRange.to !== null ||
      filters.grade !== "all" ||
      filters.brand !== "all"
    );
  }, [filters]);

  const resetFilters = () =>
    setFilters({
      dateRange: { from: null, to: null },
      grade: "all",
      brand: "all",
    });

  if (inventoryLoading || ordersLoading) return <AdminReportsSkeleton />;

  const completedOrdersCount = filteredOrders.length;
  const filteredInventoryTotalUnits = filteredInventory.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-6 pb-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Reports</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Analytics and insights for your inventory and orders
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </div>

        <ReportsFilterPanel
          filters={filters}
          setFilters={setFilters}
          availableBrands={availableBrands}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />

        <ReportsSummaryCards
          summaryStats={summaryStats}
          estimatedProfitStats={estimatedProfitStats}
          isEstimatedProfitPending={isEstimatedProfitPending}
          profitFromOrdersStats={profitFromOrdersStats}
          hasSummaryDateRange={filters.dateRange.from != null && filters.dateRange.to != null}
          completedOrdersCount={completedOrdersCount}
          filteredInventoryCount={filteredInventory.length}
          filteredInventoryTotalUnits={filteredInventoryTotalUnits}
        />

        <ReportsChartsGrid
          trendData={trendData}
          trendGrouping={trendGrouping}
          hasDateRangeFrom={filters.dateRange.from != null}
          valueByDevice={valueByDevice}
          stockByGrade={stockByGrade}
          stockByStatus={stockByStatus}
        />
      </div>
    </div>
  );
}
