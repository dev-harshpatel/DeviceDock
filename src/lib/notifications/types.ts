export const NOTIFICATION_EVENT_TYPES = {
  inventoryProductAdded: "inventory_product_added",
  invitationSent: "invitation_sent",
  manualSaleRecorded: "manual_sale_recorded",
} as const;

export type NotificationEventType =
  (typeof NOTIFICATION_EVENT_TYPES)[keyof typeof NOTIFICATION_EVENT_TYPES];

export interface NotificationEventRow {
  actor_user_id: string | null;
  company_id: string;
  created_at: string;
  entity_id: string | null;
  entity_type: string | null;
  event_type: NotificationEventType;
  id: string;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
  title: string;
}

export interface InAppNotificationItem {
  id: string;
  createdAt: string;
  description: string;
  severity: "critical" | "info" | "warning";
  source: "event" | "stock";
  title: string;
  type: "inventory" | "invitation" | "manual_sale" | "stock";
}
