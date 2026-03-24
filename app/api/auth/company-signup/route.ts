import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { supabaseAdmin } from "@/lib/supabase/client/admin";
import { generateSlug, isSlugAvailable } from "@/lib/utils/slug";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
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

    if (!firstName || !lastName || !email || !password || !companyName || !country || !province || !city) {
      return NextResponse.json({ error: "All required fields must be provided" }, { status: 400 });
    }

    const slug = generateSlug(companyName);
    const slugAvailable = await isSlugAvailable(slug);

    if (!slugAvailable) {
      const suffix = Math.floor(100 + Math.random() * 900);
      const altSlug = `${slug}-${suffix}`;
      const altAvailable = await isSlugAvailable(altSlug);
      if (!altAvailable) {
        return NextResponse.json(
          { error: "A company with a similar name already exists. Please choose a different name." },
          { status: 409 }
        );
      }
      return await createCompanyAndUser({
        firstName, lastName, email, password, companyName,
        slug: altSlug, country, province, city, streetAddress,
        yearsInBusiness, businessEmail, website, redirectTo,
      });
    }

    return await createCompanyAndUser({
      firstName, lastName, email, password, companyName,
      slug, country, province, city, streetAddress,
      yearsInBusiness, businessEmail, website, redirectTo,
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
    firstName, lastName, email, password, companyName, slug,
    country, province, city,
    streetAddress, yearsInBusiness, businessEmail, website, redirectTo,
  } = params;

  // 1. Create auth user with public sign-up flow so Supabase sends
  // the confirmation email immediately using emailRedirectTo.
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
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("[company-signup] createUser error:", authError);
    return NextResponse.json({ error: authError?.message || "Failed to create account" }, { status: 500 });
  }

  const userId = authData.user.id;

  try {
    // 2. Create company record
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
      await supabaseAdmin.auth.admin.deleteUser(userId);
      console.error("[company-signup] company insert error:", companyError);
      return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
    }

    // 3. Create company_users record (owner)
    const { error: membershipError } = await supabaseAdmin
      .from("company_users")
      .insert({
        company_id: company.id,
        user_id: userId,
        role: "owner",
        status: "active",
      });

    if (membershipError) {
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      console.error("[company-signup] company_users insert error:", membershipError);
      return NextResponse.json({ error: "Failed to create membership" }, { status: 500 });
    }

    // 4. Create company_registrations audit record (best-effort)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const tokenHash = crypto.randomUUID();

    await supabaseAdmin.from("company_registrations").insert({
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

    return NextResponse.json({ slug: company.slug }, { status: 201 });
  } catch (error: unknown) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    console.error("[company-signup] unexpected error during creation:", error);
    return NextResponse.json({ error: "Failed to complete registration" }, { status: 500 });
  }
}
