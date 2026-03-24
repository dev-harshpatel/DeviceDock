import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { ensureAdmin } from "@/lib/supabase/admin-auth";

// GET /api/admin/order-color-assignments?order_id=<uuid>
// Returns colour assignments grouped by inventory_id for a fulfilled order.
// Admin-only — the RLS on order_color_assignments prevents any user access.
export async function GET(request: NextRequest) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const orderId = request.nextUrl.searchParams.get("order_id");
  if (!orderId) {
    return NextResponse.json({ error: "order_id is required" }, { status: 400 });
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("order_color_assignments")
    .select("inventory_id, color, quantity")
    .eq("order_id", orderId)
    .order("color");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by inventory_id → { [inventoryId]: { color, quantity }[] }
  const grouped: Record<string, { color: string; quantity: number }[]> = {};
  for (const row of data ?? []) {
    if (!grouped[row.inventory_id]) grouped[row.inventory_id] = [];
    grouped[row.inventory_id].push({ color: row.color, quantity: row.quantity });
  }

  return NextResponse.json({ assignments: grouped });
}
