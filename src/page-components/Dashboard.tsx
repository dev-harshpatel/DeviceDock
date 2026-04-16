"use client";

import { useMemo } from "react";
import { Package, TrendingUp, AlertTriangle, DollarSign, ShoppingCart, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useOrders } from "@/contexts/OrdersContext";
import { formatPrice, timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { StatCard } from "@/components/common/StatCard";
import { AdminDashboardSkeleton } from "@/components/skeletons/AdminDashboardSkeleton";
import { fetchInventoryStats, fetchOrderStats } from "@/lib/supabase/queries";
import { queryKeys } from "@/lib/query-keys";
import { useCompany } from "@/contexts/CompanyContext";

export default function Dashboard() {
  const { orders, isLoading: ordersLoading } = useOrders();
  const { companyId } = useCompany();

  // Single RPC per stat group — cached for 5 minutes, no refetch on window focus
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

  const stats = useMemo(() => {
    if (!inventoryStats || !orderStats) {
      return {
        totalDevices: 0,
        totalUnits: 0,
        totalValue: 0,
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
      totalValue: inventoryStats.totalValue,
      lowStockItems: inventoryStats.lowStockItems,
      totalOrders: orderStats.totalOrders,
      pendingOrders: orderStats.pendingOrders,
      totalRevenue: orderStats.totalRevenue,
      completedOrders: orderStats.completedOrders,
    };
  }, [inventoryStats, orderStats]);

  // Generate recent activity from real data
  // Note: Still uses orders from context for recent activity (small dataset)
  const recentActivity = useMemo(() => {
    const activities: Array<{
      action: string;
      device: string;
      time: string;
      type: string;
      timestamp: number;
    }> = [];

    // Add recent orders
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    recentOrders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      const items = Array.isArray(order.items) ? order.items : [];
      const firstItem = items[0];
      const deviceName =
        firstItem?.item?.deviceName ??
        (firstItem?.item as { device_name?: string } | undefined)?.device_name ??
        (items.length > 1 ? "Multiple items" : "Order");
      const itemsCount = items.length;
      activities.push({
        action: `New order ${order.status === "pending" ? "received" : order.status}`,
        device: deviceName + (itemsCount > 1 ? ` +${itemsCount - 1} more` : ""),
        time: timeAgo(orderDate),
        type: "order",
        timestamp: orderDate.getTime(),
      });
    });

    // Low stock items - fetch from stats if available
    if (inventoryStats && inventoryStats.lowStockItems > 0) {
      activities.push({
        action: "Low stock alert",
        device: `${inventoryStats.lowStockItems} item(s)`,
        time: "Recently",
        type: "alert",
        timestamp: Date.now() - 3600000, // 1 hour ago as fallback
      });
    }

    // Sort by timestamp and take most recent 5
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map(({ timestamp, ...rest }) => rest);
  }, [orders, inventoryStats]);

  // Top ordered devices (by total units ordered across approved/completed orders)
  const topDevices = useMemo(() => {
    if (!orders || orders.length === 0) {
      return [];
    }

    type TopDevice = {
      id: string;
      deviceName: string;
      sellingPrice: number;
      quantity: number;
    };

    const map = new Map<string, TopDevice>();

    orders
      // Include all orders except explicitly rejected ones so that
      // self-recorded/manual orders and in-progress orders are counted.
      .filter((order) => order.status !== "rejected")
      .forEach((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach((orderItem) => {
          const item = orderItem.item as
            | { id?: string; deviceName?: string; sellingPrice?: number; pricePerUnit?: number }
            | undefined;
          const itemId = item?.id;
          const qty = orderItem.quantity || 0;
          if (!itemId || qty <= 0) return;

          const sellingPrice = (item.sellingPrice ?? item.pricePerUnit ?? 0) as number;
          const existing = map.get(itemId);

          if (existing) {
            existing.quantity += qty;
          } else {
            map.set(itemId, {
              id: itemId,
              deviceName: item.deviceName || "Unknown Device",
              sellingPrice,
              quantity: qty,
            });
          }
        });
      });

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orders]);

  const isDashboardLoading = isLoadingStats || ordersLoading;

  if (isDashboardLoading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto lg:overflow-hidden">
      <div className="space-y-6 flex-shrink-0 pb-6">
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your inventory performance
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Devices"
            value={stats.totalDevices}
            icon={<Package className="h-5 w-5" />}
            accent="primary"
          />
          <StatCard
            title="Total Units"
            value={stats.totalUnits}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="success"
          />
          <StatCard
            title="Inventory Value"
            value={formatPrice(stats.totalValue)}
            icon={<DollarSign className="h-5 w-5" />}
            accent="primary"
          />
          <StatCard
            title="Low Stock Alerts"
            value={stats.lowStockItems}
            icon={<AlertTriangle className="h-5 w-5" />}
            accent="warning"
          />
        </div>

        {/* Order Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Orders"
            value={stats.totalOrders}
            icon={<ShoppingCart className="h-5 w-5" />}
            accent="primary"
          />
          <StatCard
            title="Pending Orders"
            value={stats.pendingOrders}
            icon={<Clock className="h-5 w-5" />}
            accent="warning"
          />
          <StatCard
            title="Total Revenue"
            value={formatPrice(stats.totalRevenue)}
            icon={<DollarSign className="h-5 w-5" />}
            accent="success"
          />
          <StatCard
            title="Completed Orders"
            value={stats.completedOrders}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="success"
          />
        </div>
      </div>

      {/* Two Column Layout - Scrollable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 mt-6 pb-6 lg:pb-0">
        {/* Recent Activity */}
        <div className="bg-card rounded-lg border border-border shadow-soft flex flex-col h-[300px] lg:h-auto lg:min-h-0">
          <div className="px-6 py-4 border-b border-border flex-shrink-0">
            <h3 className="font-semibold text-foreground">Recent Activity</h3>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="divide-y divide-border">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, idx) => (
                  <div key={idx} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{activity.action}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{activity.device}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No recent activity"
                  description="Activity will appear here as orders are processed."
                />
              )}
            </div>
          </div>
        </div>

        {/* Top Value Devices */}
        <div className="bg-card rounded-lg border border-border shadow-soft flex flex-col h-[300px] lg:h-auto lg:min-h-0">
          <div className="px-6 py-4 border-b border-border flex-shrink-0">
            <h3 className="font-semibold text-foreground">Top Value Devices</h3>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="divide-y divide-border">
              {topDevices.length > 0 ? (
                topDevices.map((device, idx) => (
                  <div key={device.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground w-5">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{device.deviceName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {device.quantity} units × {formatPrice(device.sellingPrice)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatPrice(device.quantity * device.sellingPrice)}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No devices available"
                  description="Device statistics will appear here once inventory is added."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
