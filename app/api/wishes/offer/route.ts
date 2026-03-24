import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { Database } from "@/lib/database.types";
import { ensureAdmin } from "@/lib/supabase/admin-auth";

type UpdateType = Database["public"]["Tables"]["wishes"]["Update"];

export async function POST(request: NextRequest) {
  const authError = await ensureAdmin();
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const {
      id,
      status,
      offerPricePerUnit,
      offerQty,
      offerInventoryItemId,
      adminNotes,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Wish id is required" },
        { status: 400 }
      );
    }

    if (!status || !["offered", "rejected", "fulfilled"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be one of: offered, rejected, fulfilled" },
        { status: 400 }
      );
    }

    const update: UpdateType = {
      status,
    };

    if (offerPricePerUnit !== undefined)
      update.offer_price_per_unit =
        offerPricePerUnit == null ? null : Number(offerPricePerUnit);
    if (offerQty !== undefined)
      update.offer_qty = offerQty == null ? null : Number(offerQty);
    if (offerInventoryItemId !== undefined)
      update.offer_inventory_item_id =
        offerInventoryItemId == null ? null : offerInventoryItemId;
    if (adminNotes !== undefined) update.admin_notes = adminNotes;

    if (status === "offered") {
      update.offer_created_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("wishes")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ wish: data }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

