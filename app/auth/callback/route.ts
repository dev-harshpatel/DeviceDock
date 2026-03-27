import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { Database } from "@/lib/database.types";
import { type EmailOtpType } from "@supabase/supabase-js";

async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Can be ignored if middleware is refreshing user sessions
          }
        },
      },
    },
  );
}

async function redirectAfterAuth(
  supabase: Awaited<ReturnType<typeof getSupabaseClient>>,
  origin: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Check super admin first
    const { data: superAdmin } = await supabase
      .from("platform_super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (superAdmin) {
      return NextResponse.redirect(`${origin}/superadmin/dashboard`);
    }

    // Find the user's active company membership and redirect to their dashboard
    const { data: membership } = await supabase
      .from("company_users")
      .select("companies(slug)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();

    const row = membership as { companies: { slug: string } | null } | null;
    const slug = row?.companies?.slug;
    if (slug) {
      return NextResponse.redirect(`${origin}/${slug}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const code = requestUrl.searchParams.get("code");
  const flow = requestUrl.searchParams.get("flow");

  try {
    const supabase = await getSupabaseClient();

    // Token hash flow (email confirmation links, password recovery) — no PKCE verifier needed
    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      });

      if (error) {
        console.error("[Auth Callback] Token verification error:", {
          message: error.message,
          status: error.status,
        });
        const reason =
          error.message?.includes("expired") || error.message?.includes("otp_expired")
            ? "otp_expired"
            : undefined;
        const errorUrl = new URL(`${origin}/auth/auth-code-error`);
        if (reason) errorUrl.searchParams.set("reason", reason);
        // Forward recovery flow so the error page knows to resend a reset link, not a signup email
        if (type === "recovery" || flow === "recovery") {
          errorUrl.searchParams.set("flow", "recovery");
        }
        return NextResponse.redirect(errorUrl.toString());
      }

      // Password recovery: redirect to reset-password page to set new password
      if (type === "recovery" || flow === "recovery") {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }

      return redirectAfterAuth(supabase, origin);
    }

    // PKCE code flow (email confirmation or OAuth) — requires code_verifier in cookies
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error("[Auth Callback] Code exchange error:", {
          message: exchangeError.message,
          status: exchangeError.status,
        });

        // Check if user is already verified despite the error
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && user.email_confirmed_at) {
          return NextResponse.redirect(`${origin}/login`);
        }

        if (exchangeError.message?.includes("redirect") || exchangeError.message?.includes("URL")) {
          return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=redirect_mismatch`);
        }

        // Forward recovery context so the error page shows the right message
        // and the resend button sends a password reset email, not a signup email.
        if (flow === "recovery" || type === "recovery") {
          return NextResponse.redirect(
            `${origin}/auth/auth-code-error?reason=otp_expired&flow=recovery`,
          );
        }

        return NextResponse.redirect(`${origin}/auth/auth-code-error`);
      }

      // If this code flow was triggered for a password recovery link,
      // send the user to the reset-password page after the session is created.
      if (type === "recovery" || flow === "recovery") {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }

      return redirectAfterAuth(supabase, origin);
    }

    // No token_hash/code can still happen for hash-based links where tokens are
    // in URL fragment (#access_token=...), which the server cannot read.
    return NextResponse.redirect(`${origin}/auth/confirm`);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[Auth Callback] Unexpected error:", err?.message);
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }
}
