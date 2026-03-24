import { NextResponse } from "next/server";
import { ensureSuperAdmin } from "@/lib/supabase/auth-helpers";
import { getTenantHealthAnalytics } from "@/lib/superadmin/tenant-health";

export async function GET() {
  const userId = await ensureSuperAdmin();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getTenantHealthAnalytics();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tenant health";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
