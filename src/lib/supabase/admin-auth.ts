import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client/server";

/**
 * Ensure the current request is made by an authenticated admin user.
 *
 * Returns:
 * - `null` when the user is authenticated and has `role = 'admin'`
 * - a `NextResponse` with 401/403 when unauthorized/forbidden
 *
 * This helper is meant to be used only from server-side route handlers.
 */
export async function ensureAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single<{ role: string }>();

  if (profileError || !profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

