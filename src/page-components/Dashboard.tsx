"use client";

import { useMemo } from "react";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  Clock,
  Receipt,
  Tags,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/common/StatCard";
import { InventoryValueSparklineCard } from "@/components/dashboard/InventoryValueSparklineCard";
import { AdminDashboardSkeleton } from "@/components/skeletons/AdminDashboardSkeleton";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { buildMonthlyOrderFlowSeries } from "@/lib/dashboard/order-flow-monthly-series";
import { computeInventoryValueTotals } from "@/lib/inventory/inventory-value-totals";
import { queryKeys } from "@/lib/query-keys";
import { fetchInventoryStats, fetchOrderStats } from "@/lib/supabase/queries";
import { formatPrice } from "@/lib/utils";

export default function Dashboard() {
  const { orders, isLoading: ordersLoading } = useOrders();
  const { inventory, isLoading: inventoryLoading } = useInventory();
  const { companyId } = useCompany();

  const { data: inventoryStats, isLoading: inventoryStatsLoading } = useQuery({
    queryKey: queryKeys.inventoryStats(companyId),
    queryFn: () => fetchInventoryStats(companyId),
    staleTime: 5 * 60_000,
  });

  const { data: orderStats, isLoading: orderStatsLoading } = useQuery({
    queryKey: queryKeys.orderStats(companyId),
    queryFn: () => fetchOrderStats(companyId),
    staleTime: 5 * 60_000,
  });

  const isLoadingStats = inventoryStatsLoading || orderStatsLoading;

  const inventoryValueTotals = useMemo(() => computeInventoryValueTotals(inventory), [inventory]);

  const stats = useMemo(() => {
    if (!inventoryStats || !orderStats) {
      return {
        totalDevices: 0,
        totalUnits: 0,
        totalPurchaseValue: 0,
        totalSellingValue: 0,
        lowStockItems: 0,
        totalOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        completedOrders: 0,
      };
    }

    return {
      totalDevices: inventoryStats.totalDevices,
      totalUnits: inventoryStats.totalUnits,
      totalPurchaseValue: inventoryValueTotals.totalPurchaseValue,
      totalSellingValue: inventoryValueTotals.totalSellingValue,
      lowStockItems: inventoryStats.lowStockItems,
      totalOrders: orderStats.totalOrders,
      pendingOrders: orderStats.pendingOrders,
      totalRevenue: orderStats.totalRevenue,
      completedOrders: orderStats.completedOrders,
    };
  }, [inventoryStats, orderStats, inventoryValueTotals]);

  const monthlyOrderFlow = useMemo(() => buildMonthlyOrderFlowSeries(orders), [orders]);

  const isDashboardLoading = isLoadingStats || ordersLoading || inventoryLoading;

  if (isDashboardLoading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto xl:overflow-y-hidden">
      <div className="flex w-full flex-col gap-4 pb-6 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:gap-5 xl:pb-0">
        <div className="shrink-0">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Dashboard</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Overview of your inventory performance
          </p>
        </div>

        {/* Below xl: natural height + page scroll. xl+: flex-fill bento without clipping. */}
        <section
          aria-label="Inventory overview"
          className="flex shrink-0 flex-col gap-2 xl:min-h-0 xl:flex-1 xl:overflow-hidden"
        >
          <div className="grid min-h-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-12 xl:grid-rows-1 xl:items-stretch xl:gap-4">
            <div className="flex min-h-0 flex-col sm:col-span-2 xl:col-span-4 xl:h-full">
              <InventoryValueSparklineCard
                variant="purchase"
                title="Inventory value (purchase)"
                description="Sum of tax-exclusive purchase cost on hand"
                value={formatPrice(stats.totalPurchaseValue)}
                icon={<Receipt className="h-5 w-5" aria-hidden />}
                series={monthlyOrderFlow}
                className="min-h-0 w-full xl:h-full xl:flex-1"
              />
            </div>
            <div className="flex min-h-0 flex-col sm:col-span-2 xl:col-span-4 xl:h-full">
              <InventoryValueSparklineCard
                variant="selling"
                title="Inventory value (selling)"
                description="Units × selling price (on hand)"
                value={formatPrice(stats.totalSellingValue)}
                icon={<Tags className="h-5 w-5" aria-hidden />}
                series={monthlyOrderFlow}
                className="min-h-0 w-full xl:h-full xl:flex-1"
              />
            </div>
            <div className="flex min-h-0 flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 xl:col-span-4 xl:flex xl:min-h-0 xl:h-full xl:flex-col xl:gap-2">
              <div className="min-h-0 sm:col-span-1 xl:flex xl:min-h-0 xl:flex-[1_1_0%]">
                <StatCard
                  fillHeight
                  title="Total Devices"
                  value={stats.totalDevices}
                  icon={<Package className="h-5 w-5" />}
                  accent="primary"
                  className="h-full w-full min-h-[6.75rem] xl:min-h-0"
                />
              </div>
              <div className="min-h-0 sm:col-span-1 xl:flex xl:min-h-0 xl:flex-[1_1_0%]">
                <StatCard
                  fillHeight
                  title="Total Units"
                  value={stats.totalUnits}
                  icon={<TrendingUp className="h-5 w-5" />}
                  accent="success"
                  className="h-full w-full min-h-[6.75rem] xl:min-h-0"
                />
              </div>
              <div className="min-h-0 sm:col-span-2 xl:flex xl:min-h-0 xl:flex-[1_1_0%]">
                <StatCard
                  fillHeight
                  title="Low Stock Alerts"
                  value={stats.lowStockItems}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  accent="warning"
                  className="h-full w-full min-h-[6.75rem] xl:min-h-0"
                />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Orders overview" className="shrink-0">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-4 lg:items-stretch [&>*]:min-w-0">
            <StatCard
              fillHeight
              title="Total Orders"
              value={stats.totalOrders}
              icon={<ShoppingCart className="h-5 w-5" />}
              accent="primary"
              className="h-full min-h-[5.5rem]"
            />
            <StatCard
              fillHeight
              title="Pending Orders"
              value={stats.pendingOrders}
              icon={<Clock className="h-5 w-5" />}
              accent="warning"
              className="h-full min-h-[5.5rem]"
            />
            <StatCard
              fillHeight
              title="Total Revenue"
              value={formatPrice(stats.totalRevenue)}
              icon={<DollarSign className="h-5 w-5" />}
              accent="success"
              className="h-full min-h-[5.5rem]"
            />
            <StatCard
              fillHeight
              title="Completed Orders"
              value={stats.completedOrders}
              icon={<TrendingUp className="h-5 w-5" />}
              accent="success"
              className="h-full min-h-[5.5rem]"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
