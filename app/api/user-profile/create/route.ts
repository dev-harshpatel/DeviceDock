import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { Database } from "@/lib/database.types";

type InsertType = Database["public"]["Tables"]["user_profiles"]["Insert"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      firstName,
      lastName,
      phone,
      businessName,
      businessAddress,
      businessAddressComponents,
      businessState,
      businessCity,
      businessCountry,
      businessYears,
      businessWebsite,
      businessEmail,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS
    // Upsert on user_id so repeated calls update the existing profile
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          // IMPORTANT: Never trust role from the client for this public route.
          // Always create profiles as regular users; admins are managed separately.
          role: "user",
          approval_status: "pending",
          approval_status_updated_at: null,
          first_name: firstName || null,
          last_name: lastName || null,
          phone: phone || null,
          business_name: businessName || null,
          business_address: businessAddress || null,
          business_address_components: businessAddressComponents || null,
          business_state: businessState || null,
          business_city: businessCity || null,
          business_country: businessCountry || null,
          business_years: businessYears || null,
          business_website: businessWebsite || null,
          business_email: businessEmail || null,
        } as InsertType,
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
