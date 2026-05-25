import { createNotificationEventQuery } from "@/lib/supabase/queries";
import type { NotificationEventType } from "@/lib/notifications/types";

interface CreateNotificationEventInput {
  actorUserId?: string | null;
  companyId: string;
  entityId?: string | null;
  entityType?: string | null;
  eventType: NotificationEventType;
  message: string;
  metadata?: Record<string, string | number | boolean | null>;
  title: string;
}

export const createNotificationEvent = async ({
  actorUserId = null,
  companyId,
  entityId = null,
  entityType = null,
  eventType,
  message,
  metadata = {},
  title,
}: CreateNotificationEventInput): Promise<void> => {
  try {
    await createNotificationEventQuery({
      actor_user_id: actorUserId,
      company_id: companyId,
      entity_id: entityId,
      entity_type: entityType,
      event_type: eventType,
      message,
      metadata,
      title,
    });
  } catch (error) {
    console.error("[notifications] createNotificationEvent failed:", error);
  }
};
