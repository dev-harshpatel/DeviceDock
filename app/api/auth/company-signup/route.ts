import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { generateSlug, isReservedSlug } from "@/lib/utils/slug";
import { NextRequest, NextResponse } from "next/server";

/** Rollback must never throw — or the handler returns 500 after auth user + email already sent. */
const safeDeleteAuthUser = async (userId: string): Promise<void> => {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[company-signup] auth.admin.deleteUser:", error.message, error);
    }
  } catch (err) {
    console.error("[company-signup] auth.admin.deleteUser exception:", err);
  }
};

/**
 * Slug uniqueness must use the service role: anon cannot read `companies` under RLS,
 * so the browser client's count was always wrong on the server.
 */
const isSlugAvailableForSignup = async (slug: string): Promise<boolean> => {
  if (isReservedSlug(slug)) return false;

  const { count, error } = await supabaseAdmin
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug);

  if (error) {
    console.error("[company-signup] slug availability check:", error.message, error);
    return false;
  }
  return (count ?? 0) === 0;
};

export async function POST(request: NextRequest) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    ) {
      console.error("[company-signup] missing Supabase URL, anon key, or service role key");
      return NextResponse.json(
        { error: "Server configuration is incomplete. Please try again later." },
        { status: 503 },
      );
    }

    const redirectTo = `${request.nextUrl.origin}/auth/confirm`;
    const {
      firstName,
      lastName,
      email,
      password,
      companyName,
      country,
      province,
      city,
      streetAddress,
      yearsInBusiness,
      businessEmail,
      website,
    } = await request.json();

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !companyName ||
      !country ||
      !province ||
      !city
    ) {
      return NextResponse.json({ error: "All required fields must be provided" }, { status: 400 });
    }

    const slug = generateSlug(companyName);
    const slugAvailable = await isSlugAvailableForSignup(slug);

    if (!slugAvailable) {
      const suffix = Math.floor(100 + Math.random() * 900);
      const altSlug = `${slug}-${suffix}`;
      const altAvailable = await isSlugAvailableForSignup(altSlug);
      if (!altAvailable) {
        return NextResponse.json(
          {
            error: "A company with a similar name already exists. Please choose a different name.",
          },
          { status: 409 },
        );
      }
      return await createCompanyAndUser({
        firstName,
        lastName,
        email,
        password,
        companyName,
        slug: altSlug,
        country,
        province,
        city,
        streetAddress,
        yearsInBusiness,
        businessEmail,
        website,
        redirectTo,
      });
    }

    return await createCompanyAndUser({
      firstName,
      lastName,
      email,
      password,
      companyName,
      slug,
      country,
      province,
      city,
      streetAddress,
      yearsInBusiness,
      businessEmail,
      website,
      redirectTo,
    });
  } catch (error: unknown) {
    console.error("[company-signup] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function createCompanyAndUser(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName: string;
  slug: string;
  country: string;
  province: string;
  city: string;
  streetAddress?: string;
  yearsInBusiness?: string;
  businessEmail?: string;
  website?: string;
  redirectTo: string;
}) {
  const {
    firstName,
    lastName,
    email,
    password,
    companyName,
    slug,
    country,
    province,
    city,
    streetAddress,
    yearsInBusiness,
    businessEmail,
    website,
    redirectTo,
  } = params;

  const supabasePublic = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const normalizedEmail = email.toLowerCase().trim();
  const { data: authData, error: authError } = await supabasePublic.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        first_name: firstName,
        full_name: `${firstName} ${lastName}`.trim(),
        last_name: lastName,
      },
      emailRedirectTo: redirectTo,
    },
  });

  if (authError || !authData.user) {
    if (
      authError?.message?.toLowerCase().includes("already registered") ||
      authError?.message?.toLowerCase().includes("already exists")
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    console.error("[company-signup] createUser error:", authError);
    return NextResponse.json(
      { error: authError?.message || "Failed to create account" },
      { status: 500 },
    );
  }

  const userId = authData.user.id;

  try {
    const settingsJson: Record<string, string> = {};
    if (website) settingsJson.website = website;
    if (streetAddress) settingsJson.street_address = streetAddress;
    if (yearsInBusiness) settingsJson.years_in_business = yearsInBusiness;
    if (businessEmail) settingsJson.business_email = businessEmail;

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: companyName.trim(),
        slug,
        status: "active",
        timezone: "America/Toronto",
        currency: "CAD",
        settings_json: settingsJson,
      })
      .select("id, slug")
      .single();

    if (companyError || !company) {
      await safeDeleteAuthUser(userId);
      console.error("[company-signup] company insert error:", companyError);
      const code = companyError?.code;
      if (code === "23505") {
        return NextResponse.json(
          {
            error:
              "That company URL is already taken. Try a slightly different business name and submit again.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Failed to create company. Please try again or contact support." },
        { status: 500 },
      );
    }

    const { error: membershipError } = await supabaseAdmin.from("company_users").insert({
      company_id: company.id,
      user_id: userId,
      role: "owner",
      status: "active",
    });

    if (membershipError) {
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      await safeDeleteAuthUser(userId);
      console.error("[company-signup] company_users insert error:", membershipError);
      return NextResponse.json(
        { error: "Failed to create membership. Please try again or contact support." },
        { status: 500 },
      );
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const tokenHash = crypto.randomUUID();

    const { error: registrationError } = await supabaseAdmin.from("company_registrations").insert({
      company_slug: slug,
      company_name: companyName.trim(),
      owner_email: email.toLowerCase().trim(),
      owner_first_name: firstName.trim(),
      owner_last_name: lastName.trim(),
      owner_phone: "",
      city,
      province,
      country,
      timezone: "America/Toronto",
      currency: "CAD",
      token_hash: tokenHash,
      expires_at: expiresAt,
      consumed_at: new Date().toISOString(),
      user_id: userId,
    });

    if (registrationError) {
      console.error(
        "[company-signup] company_registrations insert (non-fatal):",
        registrationError,
      );
    }

    return NextResponse.json({ slug: company.slug }, { status: 201 });
  } catch (error: unknown) {
    await safeDeleteAuthUser(userId);
    console.error("[company-signup] unexpected error during creation:", error);
    return NextResponse.json(
      { error: "Failed to complete registration. Please try again." },
      { status: 500 },
    );
  }
}
