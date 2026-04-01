import { NextResponse } from "next/server";
import { getAuthUser, getUserMembership } from "@/lib/supabase/auth-helpers";

/**
 * Ensure the current request is made by an authenticated company admin.
 *
 * Roles that pass: 'owner', 'manager', 'inventory_admin'
 * Roles live in `company_users` — the old `user_profiles` table is not used.
 *
 * Returns:
 * - `null`         when authorized
 * - NextResponse   with 401/403 when not
 */
export async function ensureAdmin(): Promise<NextResponse | null> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getUserMembership(user.id);
  const adminRoles = ["owner", "manager", "inventory_admin"];
  if (!membership || !adminRoles.includes(membership.membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
