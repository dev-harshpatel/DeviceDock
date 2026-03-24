import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { ensureAdmin } from "@/lib/supabase/admin-auth";

export interface ColorEntry {
  color: string;
  quantity: number;
}

// GET /api/admin/inventory-colors?inventory_id=<uuid>
export async function GET(request: NextRequest) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const inventoryId = request.nextUrl.searchParams.get("inventory_id");
  if (!inventoryId) {
    return NextResponse.json({ error: "inventory_id is required" }, { status: 400 });
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("inventory_colors")
    .select("color, quantity")
    .eq("inventory_id", inventoryId)
    .order("color");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ colors: (data ?? []) as ColorEntry[] });
}

// POST /api/admin/inventory-colors
// Body: { inventory_id: string, colors: { color: string, quantity: number }[] }
// Upserts the full colour breakdown for an inventory item.
export async function POST(request: NextRequest) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  let body: { inventory_id: string; colors: ColorEntry[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { inventory_id, colors } = body;

  if (!inventory_id || !Array.isArray(colors) || colors.length === 0) {
    return NextResponse.json(
      { error: "inventory_id and colors array are required" },
      { status: 400 }
    );
  }

  for (const c of colors) {
    if (!c.color || typeof c.color !== "string" || c.color.trim() === "") {
      return NextResponse.json({ error: "Each entry must have a non-empty color" }, { status: 400 });
    }
    if (typeof c.quantity !== "number" || c.quantity < 0 || !Number.isInteger(c.quantity)) {
      return NextResponse.json(
        { error: `Invalid quantity for color "${c.color}"` },
        { status: 400 }
      );
    }
  }

  // Upsert all colour rows (replace any existing ones for this inventory item)
  const rows = colors.map((c) => ({
    inventory_id,
    color: c.color.trim(),
    quantity: c.quantity,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await (supabaseAdmin as any)
    .from("inventory_colors")
    .upsert(rows, { onConflict: "inventory_id,color" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Remove any colours that are no longer in the new breakdown
  const keptColors = colors.map((c) => c.color.trim());
  await (supabaseAdmin as any)
    .from("inventory_colors")
    .delete()
    .eq("inventory_id", inventory_id)
    .not("color", "in", `(${keptColors.join(",")})`);

  return NextResponse.json({ success: true });
}
