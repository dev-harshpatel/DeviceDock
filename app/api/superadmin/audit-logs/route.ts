import { NextRequest, NextResponse } from "next/server";
import { ensureSuperAdmin } from "@/lib/supabase/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase/client/admin";

const PAGE_SIZE = 20;

const getQueryNumber = (
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
) => {
  const rawValue = searchParams.get(key);
  if (!rawValue) {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

export async function GET(request: NextRequest) {
  const userId = await ensureSuperAdmin();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");
  const companyId = searchParams.get("companyId");
  const from = searchParams.get("from");
  const page = Math.max(1, getQueryNumber(searchParams, "page", 1));
  const q = searchParams.get("q");
  const resourceType = searchParams.get("resourceType");
  const to = searchParams.get("to");

  let query = supabaseAdmin
    .from("platform_audit_logs")
    .select(
      "id, actor_user_id, actor_email, action, resource_type, resource_id, company_id, metadata_json, ip_address, user_agent, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (action) {
    query = query.eq("action", action);
  }
  if (resourceType) {
    query = query.eq("resource_type", resourceType);
  }
  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00.000Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59.999Z`);
  }
  if (q) {
    const escaped = q.replace(/[%_,]/g, "\\$&");
    query = query.or(
      [
        `actor_email.ilike.%${escaped}%`,
        `action.ilike.%${escaped}%`,
        `resource_type.ilike.%${escaped}%`,
        `resource_id.ilike.%${escaped}%`,
      ].join(","),
    );
  }

  const fromIndex = (page - 1) * PAGE_SIZE;
  const toIndex = fromIndex + PAGE_SIZE - 1;

  const { data, count, error } = await query.range(fromIndex, toIndex);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logs = data ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return NextResponse.json({
    logs,
    page,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages,
  });
}
