import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client/admin";

interface LogSuperAdminAuditInput {
  action: string;
  actorUserId: string;
  companyId?: string | null;
  metadata?: Record<string, boolean | number | string | null | undefined>;
  request?: NextRequest;
  resourceId: string;
  resourceType: string;
}

const getRequestIpAddress = (request?: NextRequest) => {
  if (!request) {
    return null;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
};

const getRequestUserAgent = (request?: NextRequest) => {
  if (!request) {
    return null;
  }
  return request.headers.get("user-agent");
};

const sanitizeMetadata = (
  metadata: LogSuperAdminAuditInput["metadata"],
): Record<string, boolean | number | string | null> => {
  if (!metadata) {
    return {};
  }

  return Object.entries(metadata).reduce<Record<string, boolean | number | string | null>>(
    (accumulator, [key, value]) => {
      if (value === undefined) {
        return accumulator;
      }
      accumulator[key] = value;
      return accumulator;
    },
    {},
  );
};

export const logSuperAdminAudit = async ({
  action,
  actorUserId,
  companyId = null,
  metadata,
  request,
  resourceId,
  resourceType,
}: LogSuperAdminAuditInput) => {
  let actorEmail: string | null = null;

  const actorLookup = await supabaseAdmin.auth.admin.getUserById(actorUserId);
  if (actorLookup.data.user?.email) {
    actorEmail = actorLookup.data.user.email;
  }

  const { error } = await supabaseAdmin.from("platform_audit_logs").insert({
    action,
    actor_email: actorEmail,
    actor_user_id: actorUserId,
    company_id: companyId,
    ip_address: getRequestIpAddress(request),
    metadata_json: sanitizeMetadata(metadata),
    resource_id: resourceId,
    resource_type: resourceType,
    user_agent: getRequestUserAgent(request),
  });

  if (error) {
    console.error("[superadmin-audit] failed to write audit log:", error.message);
  }
};
