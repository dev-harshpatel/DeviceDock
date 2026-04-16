"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useNotificationSettings } from "@/contexts/NotificationSettingsContext";
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { getStockStatus } from "@/data/inventory";
import { fetchNotificationEvents } from "@/lib/supabase/queries";
import { queryKeys } from "@/lib/query-keys";
import type { InAppNotificationItem } from "@/lib/notifications/types";

export const useNotificationsFeed = () => {
  const { companyId } = useCompany();
  const { inventory } = useInventory();
  const { criticalStockThreshold, lowStockThreshold, readIds } = useNotificationSettings();
  // inventoryVersion is kept so stockNotifications recalculates when realtime fires,
  // even if the inventory query hasn't resolved its background refetch yet.
  const { inventoryVersion } = useRealtimeContext();

  // Notification events — invalidated by use-realtime-invalidation when notificationVersion bumps.
  // staleTime: 0 means any invalidation triggers an immediate background refetch.
  const { data: events = [], isLoading } = useQuery({
    queryKey: queryKeys.notificationsFeed(companyId),
    queryFn: () => fetchNotificationEvents(companyId),
    staleTime: 0,
    enabled: Boolean(companyId),
  });

  const stockNotifications = useMemo<InAppNotificationItem[]>(() => {
    return inventory
      .map((item) => {
        const status = getStockStatus(item.quantity, lowStockThreshold, criticalStockThreshold);
        if (status === "in-stock") return null;

        const isOut = status === "out-of-stock";
        const isCritical = status === "critical";
        return {
          id: `stock:${item.id}:${status}:${item.quantity}`,
          createdAt: new Date().toISOString(),
          description: isOut
            ? "No units remaining - item is out of stock."
            : isCritical
              ? `Only ${item.quantity} unit${item.quantity === 1 ? "" : "s"} remaining.`
              : `${item.quantity} units remaining - restock soon.`,
          severity: isOut || isCritical ? "critical" : "warning",
          source: "stock",
          title: isOut ? "Out of stock" : isCritical ? "Critical stock level" : "Low stock warning",
          type: "stock",
        } as InAppNotificationItem;
      })
      .filter((item): item is InAppNotificationItem => Boolean(item));
  }, [criticalStockThreshold, inventory, inventoryVersion, lowStockThreshold]);

  const allNotifications = useMemo(() => {
    const merged = [...events, ...stockNotifications];
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [events, stockNotifications]);

  const unreadCount = useMemo(
    () => allNotifications.filter((notification) => !readIds.has(notification.id)).length,
    [allNotifications, readIds],
  );

  return {
    isLoading,
    notifications: allNotifications,
    unreadCount,
  };
};
