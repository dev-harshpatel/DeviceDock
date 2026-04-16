/**
 * Notification event queries
 */

import { supabase } from "../client/browser";
import {
  NOTIFICATION_EVENT_TYPES,
  type InAppNotificationItem,
  type NotificationEventRow,
} from "@/lib/notifications/types";

const NOTIFICATION_FIELDS = [
  "id",
  "company_id",
  "event_type",
  "title",
  "message",
  "metadata",
  "entity_type",
  "entity_id",
  "actor_user_id",
  "created_at",
].join(", ");

function mapEventTypeToViewType(eventType: string): InAppNotificationItem["type"] {
  if (eventType === NOTIFICATION_EVENT_TYPES.inventoryProductAdded) return "inventory";
  if (eventType === NOTIFICATION_EVENT_TYPES.invitationSent) return "invitation";
  if (eventType === NOTIFICATION_EVENT_TYPES.manualSaleRecorded) return "manual_sale";
  return "inventory";
}

/**
 * Fetches the 200 most-recent notification events for a company.
 * Maps DB rows to InAppNotificationItem so callers don't deal with raw rows.
 */
export async function fetchNotificationEvents(companyId: string): Promise<InAppNotificationItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("notification_events") as any)
    .select(NOTIFICATION_FIELDS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[fetchNotificationEvents] failed:", error);
    return [];
  }

  return ((data ?? []) as NotificationEventRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    description: row.message,
    severity: "info" as const,
    source: "event" as const,
    title: row.title,
    type: mapEventTypeToViewType(row.event_type),
  }));
}
