import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { Database } from "@/lib/database.types";
import { ensureAdmin } from "@/lib/supabase/admin-auth";

type UpdateType = Database["public"]["Tables"]["user_profiles"]["Update"];

export async function POST(request: NextRequest) {
  const authError = await ensureAdmin();
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const { userId, status } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status is required (pending, approved, or rejected)" },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .update({
        approval_status: status,
        approval_status_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as UpdateType)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile: data }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
