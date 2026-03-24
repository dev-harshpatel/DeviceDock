import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { ensureAdmin } from "@/lib/supabase/admin-auth";

export async function POST(request: NextRequest) {
  const authError = await ensureAdmin();
  if (authError) {
    return authError;
  }

  try {
    const { userIds } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ emails: {} }, { status: 200 });
    }

    // Fetch user emails using admin client
    const emailMap: Record<string, string> = {};

    // Fetch users in batches to avoid too many requests
    for (const userId of userIds) {
      try {
        const { data: user, error } =
          await supabaseAdmin.auth.admin.getUserById(userId);
        if (!error && user?.user?.email) {
          emailMap[userId] = user.user.email;
        }
      } catch (error) {
        // Continue with other users even if one fails
      }
    }

    return NextResponse.json({ emails: emailMap }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch user emails" },
      { status: 500 }
    );
  }
}
