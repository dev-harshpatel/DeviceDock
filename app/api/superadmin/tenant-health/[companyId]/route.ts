import { NextRequest, NextResponse } from "next/server";
import { ensureSuperAdmin } from "@/lib/supabase/auth-helpers";
import { getTenantHealthAnalytics } from "@/lib/superadmin/tenant-health";

interface Params {
  params: Promise<{ companyId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await ensureSuperAdmin();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await params;

  try {
    const data = await getTenantHealthAnalytics();
    const company = data.companies.find((item) => item.companyId === companyId);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tenant health";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
