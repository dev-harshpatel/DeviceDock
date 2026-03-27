"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { getStockStatus } from "@/data/inventory";
import { formatPrice } from "@/lib/utils";
import { Download, Calendar, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminReportsSkeleton } from "@/components/skeletons/AdminReportsSkeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { OrderStatus } from "@/types/order";
import { cn } from "@/lib/utils";
import { type Grade, GRADES, GRADE_LABELS } from "@/lib/constants/grades";

// Grade colors for charts
const GRADE_COLORS: Record<string, string> = {
  "Brand New Sealed": "hsl(160, 84%, 39%)",
  "Brand New Open Box": "hsl(174, 72%, 40%)",
  "Grade A": "hsl(142, 76%, 36%)",
  "Grade B": "hsl(38, 92%, 50%)",
  "Grade C": "hsl(217, 91%, 60%)",
  "Grade D": "hsl(0, 72%, 51%)",
};

// Fallback colors for other charts
const COLORS = [
  "hsl(142, 76%, 36%)", // Green
  "hsl(38, 92%, 50%)", // Yellow
  "hsl(217, 91%, 60%)", // Blue
  "hsl(0, 72%, 51%)", // Red
];

// Background tints for stat cards (hsla — appending hex suffix to hsl() is invalid CSS)
const BG_COLORS = [
  "hsla(142, 76%, 36%, 0.12)",
  "hsla(38, 92%, 50%, 0.12)",
  "hsla(217, 91%, 60%, 0.12)",
  "hsla(0, 72%, 51%, 0.12)",
];

interface ReportFilters {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  orderStatus: OrderStatus | "all";
  grade: Grade | "all";
  brand: string | "all";
}

export default function Reports() {
  const { inventory, isLoading: inventoryLoading } = useInventory();
  const { orders, isLoading: ordersLoading } = useOrders();

  // Initialize filters
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: {
      from: null,
      to: null,
    },
    orderStatus: "all",
    grade: "all",
    brand: "all",
  });

  // Get unique brands from inventory
  const availableBrands = useMemo(() => {
    const brands = new Set(inventory.map((item) => item.brand));
    return Array.from(brands).sort();
  }, [inventory]);

  // Filter orders based on date range and status
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Filter by date range
    if (filters.dateRange.from || filters.dateRange.to) {
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.createdAt);
        if (filters.dateRange.from && orderDate < filters.dateRange.from) return false;
        if (filters.dateRange.to) {
          const toDate = new Date(filters.dateRange.to);
          toDate.setHours(23, 59, 59, 999); // Include entire end date
          if (orderDate > toDate) return false;
        }
        return true;
      });
    }

    // Filter by order status
    if (filters.orderStatus !== "all") {
      filtered = filtered.filter((order) => order.status === filters.orderStatus);
    }

    return filtered;
  }, [orders, filters.dateRange, filters.orderStatus]);

  // Filter inventory based on grade and brand
  const filteredInventory = useMemo(() => {
    let filtered = inventory;

    if (filters.grade !== "all") {
      filtered = filtered.filter((item) => item.grade === filters.grade);
    }

    if (filters.brand !== "all") {
      filtered = filtered.filter((item) => item.brand === filters.brand);
    }

    return filtered;
  }, [inventory, filters.grade, filters.brand]);

  // Generate trend data from orders (grouped by month/week/day based on range)
  const trendData = useMemo(() => {
    if (filteredOrders.length === 0) return [];

    const ordersByPeriod = new Map<string, { units: number; value: number; orders: number }>();

    filteredOrders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      let periodKey: string;

      // Determine grouping based on date range
      const daysDiff =
        filters.dateRange.from && filters.dateRange.to
          ? Math.ceil(
              (filters.dateRange.to.getTime() - filters.dateRange.from.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 365; // Default to yearly if no range

      if (daysDiff <= 7) {
        // Group by day
        periodKey = format(orderDate, "MMM dd");
      } else if (daysDiff <= 90) {
        // Group by week
        const weekStart = new Date(orderDate);
        weekStart.setDate(orderDate.getDate() - orderDate.getDay());
        periodKey = format(weekStart, "MMM dd");
      } else {
        // Group by month
        periodKey = format(orderDate, "MMM yyyy");
      }

      const existing = ordersByPeriod.get(periodKey) || {
        units: 0,
        value: 0,
        orders: 0,
      };

      // Calculate units and value from order items
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
      .map(([period, data]) => ({
        period,
        units: data.units,
        value: data.value,
        orders: data.orders,
      }))
      .sort((a, b) => {
        // Sort by date
        const dateA = new Date(a.period);
        const dateB = new Date(b.period);
        return dateA.getTime() - dateB.getTime();
      });
  }, [filteredOrders, filters.dateRange]);

  // Stock by Grade (filtered)
  const stockByGrade = useMemo(() => {
    return GRADES.map((g) => ({
      name: GRADE_LABELS[g],
      value: filteredInventory.filter((i) => i.grade === g).reduce((s, i) => s + i.quantity, 0),
    })).filter((d) => d.value > 0);
  }, [filteredInventory]);

  // Stock by Status (filtered)
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

  // Value by Device (filtered)
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

  // Order Status Distribution
  const orderStatusDistribution = useMemo(() => {
    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
    };

    filteredOrders.forEach((order) => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    return [
      { name: "Pending", value: statusCounts.pending },
      { name: "Approved", value: statusCounts.approved },
      { name: "Rejected", value: statusCounts.rejected },
      { name: "Completed", value: statusCounts.completed },
    ].filter((d) => d.value > 0);
  }, [filteredOrders]);

  // Revenue by Status
  const revenueByStatus = useMemo(() => {
    const revenue = {
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
    };

    filteredOrders.forEach((order) => {
      revenue[order.status] = (revenue[order.status] || 0) + order.totalPrice;
    });

    return [
      { name: "Pending", value: revenue.pending },
      { name: "Approved", value: revenue.approved },
      { name: "Rejected", value: revenue.rejected },
      { name: "Completed", value: revenue.completed },
    ].filter((d) => d.value > 0);
  }, [filteredOrders]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalRevenue = filteredOrders
      .filter((o) => o.status === "approved" || o.status === "completed")
      .reduce((sum, order) => sum + order.totalPrice, 0);

    const totalOrders = filteredOrders.length;
    const totalUnits = filteredOrders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    return {
      totalRevenue,
      totalOrders,
      totalUnits,
    };
  }, [filteredOrders]);

  // Cost per unit WITHOUT HST: purchasePrice/quantity (e.g. 10500/50 = 210).
  // pricePerUnit includes HST, so we use purchasePrice/quantity to exclude it.
  const getCostPerUnitWithoutHst = (
    purchasePrice: number | null | undefined,
    quantity: number,
    pricePerUnit: number,
    hst: number | null | undefined,
  ): number | null => {
    if (quantity <= 0) return null;
    if (purchasePrice != null) {
      return purchasePrice / quantity;
    }
    if (hst != null && hst > 0) {
      return pricePerUnit / (1 + hst / 100);
    }
    return pricePerUnit;
  };

  // Estimated profit: (selling - cost) × qty. Cost is per-unit WITHOUT HST.
  const estimatedProfitStats = useMemo(() => {
    let totalProfit = 0;
    let itemsWithData = 0;

    filteredInventory.forEach((item) => {
      const costPerUnit = getCostPerUnitWithoutHst(
        item.purchasePrice,
        item.quantity,
        item.pricePerUnit,
        item.hst,
      );
      if (costPerUnit == null) return;

      const selling = Number.isFinite(item.sellingPrice) ? item.sellingPrice : 0;
      const qty = Number.isFinite(item.quantity) ? item.quantity : 0;

      const profitDelta = (selling - costPerUnit) * qty;
      if (Number.isFinite(profitDelta)) {
        totalProfit += profitDelta;
        itemsWithData++;
      }
    });

    if (!Number.isFinite(totalProfit)) {
      totalProfit = 0;
    }

    return { totalProfit, itemsWithData };
  }, [filteredInventory]);

  const isEstimatedProfitPending = useMemo(() => {
    if (inventoryLoading) return true;
    if (filteredInventory.length === 0) return false;

    // If rows are present but none have computable cost/selling inputs yet,
    // keep showing loading state instead of a misleading "$0 · 0 items".
    return estimatedProfitStats.itemsWithData === 0;
  }, [inventoryLoading, filteredInventory.length, estimatedProfitStats.itemsWithData]);

  // Profit from orders in the selected date range (approved/completed only).
  // Per line: (selling - cost) × qty. Cost is per-unit WITHOUT HST.
  const profitFromOrdersStats = useMemo(() => {
    const completedOrders = filteredOrders.filter(
      (o) => o.status === "approved" || o.status === "completed",
    );
    let totalProfit = 0;
    let orderCount = 0;

    completedOrders.forEach((order) => {
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
        const costBase = (item?.pricePerUnit ?? 0) as number;
        const cost = costPerUnit ?? costBase;

        const profitDelta = (selling - cost) * qty;
        if (Number.isFinite(profitDelta)) {
          totalProfit += profitDelta;
        }
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

    if (!Number.isFinite(totalProfit)) {
      totalProfit = 0;
    }

    return { totalProfit, orderCount, periodLabel };
  }, [filteredOrders, filters.dateRange.from, filters.dateRange.to]);

  // Reset filters
  const resetFilters = () => {
    setFilters({
      dateRange: { from: null, to: null },
      orderStatus: "all",
      grade: "all",
      brand: "all",
    });
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.dateRange.from !== null ||
      filters.dateRange.to !== null ||
      filters.orderStatus !== "all" ||
      filters.grade !== "all" ||
      filters.brand !== "all"
    );
  }, [filters]);

  if (inventoryLoading || ordersLoading) {
    return <AdminReportsSkeleton />;
  }

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

        {/* Filters Section */}
        <div className="bg-card rounded-lg border border-border shadow-soft p-4">
          {/* Label row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Filters:</span>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-muted-foreground hover:text-foreground h-7 px-2"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>

          {/* Filter controls — 2-col grid on mobile, single flex row on sm+ */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
            {/* From date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[130px] h-9 justify-start text-left text-sm font-normal px-3",
                    !filters.dateRange.from && "text-muted-foreground",
                  )}
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {filters.dateRange.from ? format(filters.dateRange.from, "MMM dd, y") : "From"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="single"
                  selected={filters.dateRange.from ?? undefined}
                  onSelect={(day) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateRange: {
                        ...prev.dateRange,
                        from: day ?? null,
                        to:
                          prev.dateRange.to && day && day > prev.dateRange.to
                            ? null
                            : prev.dateRange.to,
                      },
                    }))
                  }
                />
              </PopoverContent>
            </Popover>

            {/* To date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[130px] h-9 justify-start text-left text-sm font-normal px-3",
                    !filters.dateRange.to && "text-muted-foreground",
                  )}
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {filters.dateRange.to ? format(filters.dateRange.to, "MMM dd, y") : "To"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="single"
                  selected={filters.dateRange.to ?? undefined}
                  disabled={filters.dateRange.from ? { before: filters.dateRange.from } : undefined}
                  defaultMonth={filters.dateRange.from ?? undefined}
                  onSelect={(day) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, to: day ?? null },
                    }))
                  }
                />
              </PopoverContent>
            </Popover>

            {/* Order Status Filter */}
            <Select
              value={filters.orderStatus}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  orderStatus: value as OrderStatus | "all",
                }))
              }
            >
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
                <SelectValue placeholder="Order Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            {/* Grade Filter */}
            <Select
              value={filters.grade}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  grade: value as Grade | "all",
                }))
              }
            >
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GRADE_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Brand Filter */}
            <Select
              value={filters.brand}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, brand: value }))}
            >
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {availableBrands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-card rounded-lg border border-border shadow-soft p-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatPrice(summaryStats.totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {
                filteredOrders.filter((o) => o.status === "approved" || o.status === "completed")
                  .length
              }{" "}
              completed orders
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border shadow-soft p-4">
            <p className="text-sm text-muted-foreground">Estimated Profit</p>
            <p
              className={cn(
                "text-2xl font-bold mt-1",
                estimatedProfitStats.totalProfit >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {isEstimatedProfitPending
                ? "Calculating..."
                : formatPrice(estimatedProfitStats.totalProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              (Selling − Cost/unit) × Qty · Excl. HST ·{" "}
              {isEstimatedProfitPending ? "…" : estimatedProfitStats.itemsWithData} items
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border shadow-soft p-4">
            <p className="text-sm text-muted-foreground">{profitFromOrdersStats.periodLabel}</p>
            <p
              className={cn(
                "text-2xl font-bold mt-1",
                profitFromOrdersStats.totalProfit >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {formatPrice(profitFromOrdersStats.totalProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              From {profitFromOrdersStats.orderCount} completed orders
              {filters.dateRange.from && filters.dateRange.to && <> in selected range</>}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border shadow-soft p-4">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summaryStats.totalOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.totalUnits} total units
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border shadow-soft p-4">
            <p className="text-sm text-muted-foreground">Inventory Items</p>
            <p className="text-2xl font-bold text-foreground mt-1">{filteredInventory.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredInventory.reduce((sum, item) => sum + item.quantity, 0)} total units
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Orders & Revenue Trend */}
          <div className="bg-card rounded-lg border border-border shadow-soft p-6 lg:col-span-2">
            <h3 className="font-semibold text-foreground mb-4">Orders & Revenue Trend</h3>
            {trendData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      cursor={{
                        stroke: "hsl(var(--muted-foreground))",
                        strokeWidth: 1,
                        opacity: 0.5,
                      }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary) / 0.4)",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                        boxShadow: "0 4px 12px hsl(0 0% 0% / 0.4)",
                        fontSize: "13px",
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="orders"
                      stroke="hsl(245, 58%, 60%)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Orders"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="units"
                      stroke="hsl(38, 92%, 50%)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Units"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(142, 76%, 36%)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Revenue ($)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                No data available for the selected filters
              </div>
            )}
          </div>

          {/* Value by Device */}
          <div className="bg-card rounded-lg border border-border shadow-soft p-6">
            <h3 className="font-semibold text-foreground mb-4">Value by Device</h3>
            {valueByDevice.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueByDevice} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      width={80}
                    />
                    <Tooltip
                      formatter={(value: number) => formatPrice(value)}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary) / 0.4)",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                        boxShadow: "0 4px 12px hsl(0 0% 0% / 0.4)",
                        fontSize: "13px",
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                    <Bar dataKey="value" fill="hsl(245, 58%, 60%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </div>

          {/* Units by Grade */}
          <div className="bg-card rounded-lg border border-border shadow-soft p-6">
            <h3 className="font-semibold text-foreground mb-4">Units by Grade</h3>
            {stockByGrade.length > 0 ? (
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stockByGrade}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {stockByGrade.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={GRADE_COLORS[entry.name] || COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary) / 0.4)",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                        boxShadow: "0 4px 12px hsl(0 0% 0% / 0.4)",
                        fontSize: "13px",
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </div>

          {/* Order Status Distribution */}
          <div className="bg-card rounded-lg border border-border shadow-soft p-6">
            <h3 className="font-semibold text-foreground mb-4">Order Status Distribution</h3>
            {orderStatusDistribution.length > 0 ? (
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {orderStatusDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary) / 0.4)",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                        boxShadow: "0 4px 12px hsl(0 0% 0% / 0.4)",
                        fontSize: "13px",
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No orders found
              </div>
            )}
          </div>

          {/* Revenue by Status */}
          <div className="bg-card rounded-lg border border-border shadow-soft p-6">
            <h3 className="font-semibold text-foreground mb-4">Revenue by Status</h3>
            {revenueByStatus.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatPrice(value)}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary) / 0.4)",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                        boxShadow: "0 4px 12px hsl(0 0% 0% / 0.4)",
                        fontSize: "13px",
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                    <Bar dataKey="value" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No revenue data
              </div>
            )}
          </div>

          {/* Stock Status Distribution */}
          <div className="bg-card rounded-lg border border-border shadow-soft p-6 lg:col-span-2">
            <h3 className="font-semibold text-foreground mb-4">Stock Status Distribution</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {stockByStatus.map((status) => (
                <div
                  key={status.name}
                  className="text-center p-2 sm:p-4 rounded-lg"
                  style={{ backgroundColor: status.bg }}
                >
                  <p className="text-2xl sm:text-3xl font-bold" style={{ color: status.color }}>
                    {status.value}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-tight">
                    {status.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
