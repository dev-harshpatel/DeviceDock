/* eslint-disable @typescript-eslint/no-explicit-any -- supabaseAdmin queries mirror fulfill-order */
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getUserMembership } from "@/lib/supabase/auth-helpers";
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

type OrderItemRow = {
  quantity?: number;
  item?: { id?: string };
};

const aggregateOrderedQtyByInventoryId = (items: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!Array.isArray(items)) return out;
  for (const line of items) {
    const row = line as OrderItemRow;
    const invId = row.item?.id;
    if (!invId || typeof invId !== "string") continue;
    const q = typeof row.quantity === "number" ? row.quantity : 0;
    out[invId] = (out[invId] ?? 0) + q;
  }
  return out;
};

// POST /api/admin/assign-manual-sale-colors
// After update_manual_sale_order RPC: apply colour consumption + order_color_assignments only
// (inventory.quantity is already adjusted by the RPC).
export async function POST(request: NextRequest) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getUserMembership(user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = membership.company.id;

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
      { status: 400 },
    );
  }

  const { data: orderRow, error: orderErr } = await (supabaseAdmin as any)
    .from("orders")
    .select("id, company_id, is_manual_sale, items")
    .eq("id", order_id)
    .single();

  if (orderErr || !orderRow) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (orderRow.company_id !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!orderRow.is_manual_sale) {
    return NextResponse.json({ error: "Not a manual sale order" }, { status: 400 });
  }

  const orderedByInv = aggregateOrderedQtyByInventoryId(orderRow.items);

  for (const assignment of color_assignments) {
    const colorTotal = assignment.colors.reduce((sum, c) => sum + c.quantity, 0);
    const expected = orderedByInv[assignment.inventory_id];
    if (expected === undefined) {
      return NextResponse.json(
        { error: `No order line for inventory item ${assignment.inventory_id}` },
        { status: 400 },
      );
    }
    if (colorTotal !== assignment.ordered_quantity) {
      return NextResponse.json(
        {
          error: `Colour quantities (${colorTotal}) do not match ordered quantity (${assignment.ordered_quantity}) for item ${assignment.inventory_id}`,
        },
        { status: 400 },
      );
    }
    if (expected !== assignment.ordered_quantity) {
      return NextResponse.json(
        {
          error: `Colour block ordered_quantity (${assignment.ordered_quantity}) does not match order line total (${expected}) for item ${assignment.inventory_id}`,
        },
        { status: 400 },
      );
    }
    for (const c of assignment.colors) {
      if (!c.color || c.quantity < 0 || !Number.isInteger(c.quantity)) {
        return NextResponse.json(
          { error: `Invalid colour entry for item ${assignment.inventory_id}` },
          { status: 400 },
        );
      }
    }
  }

  for (const assignment of color_assignments) {
    const { inventory_id, colors } = assignment;

    for (const c of colors) {
      if (c.quantity === 0) continue;

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
          { onConflict: "inventory_id,color" },
        );

      if (colorUpdateError) {
        return NextResponse.json({ error: colorUpdateError.message }, { status: 500 });
      }
    }
  }

  const assignmentRows = color_assignments.flatMap((assignment) =>
    assignment.colors.map((c) => ({
      order_id,
      inventory_id: assignment.inventory_id,
      color: c.color,
      quantity: c.quantity,
    })),
  );

  if (assignmentRows.length > 0) {
    const { error: assignError } = await (supabaseAdmin as any)
      .from("order_color_assignments")
      .insert(assignmentRows);

    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
