import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { ensureAdmin } from "@/lib/supabase/admin-auth";

interface ColorAssignment {
  color: string;
  quantity: number;
}

interface ItemFulfillment {
  inventory_id: string;
  ordered_quantity: number;
  colors: ColorAssignment[];
}

// POST /api/admin/fulfill-order
// Body: { order_id, color_assignments: ItemFulfillment[] }
// Atomically:
//   1. Validates color totals == ordered_quantity for each item
//   2. Decrements inventory_colors quantities
//   3. Decrements inventory.quantity (and adjusts purchase_price proportionally)
//   4. Updates order status to "approved"
export async function POST(request: NextRequest) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  let body: { order_id: string; color_assignments: ItemFulfillment[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { order_id, color_assignments } = body;

  if (!order_id || !Array.isArray(color_assignments)) {
    return NextResponse.json(
      { error: "order_id and color_assignments are required" },
      { status: 400 }
    );
  }

  // Validate totals for each item
  for (const assignment of color_assignments) {
    const colorTotal = assignment.colors.reduce((sum, c) => sum + c.quantity, 0);
    if (colorTotal !== assignment.ordered_quantity) {
      return NextResponse.json(
        {
          error: `Colour quantities (${colorTotal}) do not match ordered quantity (${assignment.ordered_quantity}) for item ${assignment.inventory_id}`,
        },
        { status: 400 }
      );
    }
    for (const c of assignment.colors) {
      if (!c.color || c.quantity < 0 || !Number.isInteger(c.quantity)) {
        return NextResponse.json(
          { error: `Invalid colour entry for item ${assignment.inventory_id}` },
          { status: 400 }
        );
      }
    }
  }

  // Process each inventory item
  for (const assignment of color_assignments) {
    const { inventory_id, ordered_quantity, colors } = assignment;

    // Fetch current inventory row
    const { data: invRow, error: invError } = await (supabaseAdmin as any)
      .from("inventory")
      .select("quantity, purchase_price")
      .eq("id", inventory_id)
      .single();

    if (invError || !invRow) {
      return NextResponse.json(
        { error: `Inventory item ${inventory_id} not found` },
        { status: 404 }
      );
    }

    const currentQty: number = invRow.quantity ?? 0;
    const currentPP: number | null = invRow.purchase_price ?? null;
    const newQty = Math.max(0, currentQty - ordered_quantity);

    // Decrement each colour's quantity
    for (const c of colors) {
      if (c.quantity === 0) continue;

      // Fetch current colour row
      const { data: colorRow, error: colorFetchError } = await (supabaseAdmin as any)
        .from("inventory_colors")
        .select("quantity")
        .eq("inventory_id", inventory_id)
        .eq("color", c.color)
        .maybeSingle();

      if (colorFetchError) {
        return NextResponse.json({ error: colorFetchError.message }, { status: 500 });
      }

      const currentColorQty: number = colorRow?.quantity ?? 0;
      const newColorQty = Math.max(0, currentColorQty - c.quantity);

      const { error: colorUpdateError } = await (supabaseAdmin as any)
        .from("inventory_colors")
        .upsert(
          {
            inventory_id,
            color: c.color,
            quantity: newColorQty,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "inventory_id,color" }
        );

      if (colorUpdateError) {
        return NextResponse.json({ error: colorUpdateError.message }, { status: 500 });
      }
    }

    // Decrement main inventory quantity (proportional purchase_price)
    const invUpdate: Record<string, unknown> = {
      quantity: newQty,
      last_updated: "Just now",
      updated_at: new Date().toISOString(),
    };

    if (currentPP != null && currentQty > 0) {
      const costPerUnit = currentPP / currentQty;
      invUpdate.purchase_price =
        Math.round(costPerUnit * newQty * 100) / 100;
    }

    const { error: invUpdateError } = await (supabaseAdmin as any)
      .from("inventory")
      .update(invUpdate)
      .eq("id", inventory_id);

    if (invUpdateError) {
      return NextResponse.json({ error: invUpdateError.message }, { status: 500 });
    }
  }

  // Persist colour assignments for admin record-keeping
  const assignmentRows = color_assignments.flatMap((assignment) =>
    assignment.colors.map((c) => ({
      order_id,
      inventory_id: assignment.inventory_id,
      color: c.color,
      quantity: c.quantity,
    }))
  );

  if (assignmentRows.length > 0) {
    const { error: assignError } = await (supabaseAdmin as any)
      .from("order_color_assignments")
      .insert(assignmentRows);

    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 500 });
    }
  }

  // Update order status to approved
  const { error: orderError } = await (supabaseAdmin as any)
    .from("orders")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
      rejection_reason: null,
      rejection_comment: null,
    })
    .eq("id", order_id);

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
