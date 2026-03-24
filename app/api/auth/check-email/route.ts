import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client/admin";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase();
    const perPage = 200;
    let page = 1;
    let exists = false;

    // Check all pages so existing emails are not missed once auth.users grows.
    while (!exists) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        console.error("[check-email] listUsers error:", error);
        return NextResponse.json(
          { error: "Failed to check existing users" },
          { status: 500 }
        );
      }

      const users = data?.users ?? [];
      exists = users.some(
        (u: any) => u.email && u.email.toLowerCase() === emailLower
      );

      if (users.length < perPage) {
        break;
      }
      page += 1;
    }

    return NextResponse.json({ exists });
  } catch (error: any) {
    console.error("[check-email] unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to check email" },
      { status: 500 }
    );
  }
}
