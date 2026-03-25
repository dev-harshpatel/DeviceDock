import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { getAuthUser } from "@/lib/supabase/auth-helpers";

type CompanyInvitationRow = Database["public"]["Tables"]["company_invitations"]["Row"];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, mode, firstName, lastName, password } = body as {
    token: string;
    mode: "signup" | "signin";
    firstName?: string;
    lastName?: string;
    password?: string;
  };

  if (!token || !mode) {
    return NextResponse.json({ error: "token and mode are required" }, { status: 400 });
  }

  // Validate the invitation token
  const { data: invitation, error: inviteError } = await supabaseAdmin
    .from("company_invitations")
    .select("*")
    .eq("token_hash", token)
    .is("consumed_at", null)
    .single();

  if (inviteError || !invitation) {
    return NextResponse.json({ error: "Invitation not found or already used" }, { status: 404 });
  }

  const inv = invitation as CompanyInvitationRow;

  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
  }

  let userId: string;

  if (mode === "signup") {
    if (!firstName || !lastName || !password) {
      return NextResponse.json(
        { error: "firstName, lastName, and password are required" },
        { status: 400 },
      );
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: inv.invitee_email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
      },
    });

    if (createError || !created.user) {
      if (createError?.message?.toLowerCase().includes("already")) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please use "Sign In" instead.' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: createError?.message ?? "Failed to create account" },
        { status: 500 },
      );
    }

    userId = created.user.id;
  } else {
    // signin mode: user must already be authenticated (session cookie set by client-side sign-in)
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to accept this invitation" },
        { status: 401 },
      );
    }

    if (user.email?.toLowerCase() !== inv.invitee_email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address" },
        { status: 400 },
      );
    }

    userId = user.id;
  }

  // Upsert company membership (handles re-invite case)
  const { error: memberError } = await supabaseAdmin.from("company_users").upsert(
    {
      company_id: inv.company_id,
      user_id: userId,
      role: inv.role_to_assign,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,user_id" },
  );

  if (memberError) {
    return NextResponse.json({ error: "Failed to add user to company" }, { status: 500 });
  }

  // Mark invitation as consumed
  await supabaseAdmin
    .from("company_invitations")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", inv.id);

  return NextResponse.json({ slug: inv.company_slug });
}
