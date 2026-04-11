"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useNotificationSettings } from "@/contexts/NotificationSettingsContext";
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { getStockStatus } from "@/data/inventory";
import { supabase } from "@/lib/supabase/client";
import {
  NOTIFICATION_EVENT_TYPES,
  type InAppNotificationItem,
  type NotificationEventRow,
} from "@/lib/notifications/types";

const mapEventTypeToViewType = (eventType: string): InAppNotificationItem["type"] => {
  if (eventType === NOTIFICATION_EVENT_TYPES.inventoryProductAdded) return "inventory";
  if (eventType === NOTIFICATION_EVENT_TYPES.invitationSent) return "invitation";
  if (eventType === NOTIFICATION_EVENT_TYPES.manualSaleRecorded) return "manual_sale";
  return "inventory";
};

const mapEventRows = (rows: NotificationEventRow[]): InAppNotificationItem[] => {
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    description: row.message,
    severity: "info",
    source: "event",
    title: row.title,
    type: mapEventTypeToViewType(row.event_type),
  }));
};

export const useNotificationsFeed = () => {
  const { companyId } = useCompany();
  const { inventory } = useInventory();
  const { criticalStockThreshold, lowStockThreshold, readIds } = useNotificationSettings();
  const { inventoryVersion, notificationVersion } = useRealtimeContext();
  const [events, setEvents] = useState<InAppNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const loadEvents = async () => {
      setIsLoading(true);
      const { data, error } = await (supabase.from("notification_events") as any)
        .select(
          "id, company_id, event_type, title, message, metadata, entity_type, entity_id, actor_user_id, created_at",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (cancelled) return;

      if (error) {
        console.error("[notifications] loadEvents failed:", error);
        setEvents([]);
        setIsLoading(false);
        return;
      }

      setEvents(mapEventRows((data ?? []) as NotificationEventRow[]));
      setIsLoading(false);
    };

    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, [companyId, notificationVersion]);

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
