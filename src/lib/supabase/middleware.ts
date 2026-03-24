import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { Database } from "../database.types";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/signup", "/auth", "/superadmin/login"];

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for Next.js internal routes and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$/i)
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  let user = null;
  try {
    const {
      data: { user: fetchedUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (
        error.message?.includes("refresh_token_not_found") ||
        error.message?.includes("Invalid Refresh Token")
      ) {
        // Clear stale auth cookies
        const allCookies = request.cookies.getAll();
        allCookies.forEach((cookie) => {
          if (cookie.name.startsWith("sb-") && cookie.name.includes("auth")) {
            supabaseResponse.cookies.set(cookie.name, "", {
              path: "/",
              maxAge: 0,
            });
          }
        });
        user = null;
      } else {
        console.error("Auth error in middleware:", error.message);
        user = null;
      }
    } else {
      user = fetchedUser;
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (
      err?.message?.includes("refresh_token_not_found") ||
      err?.message?.includes("Invalid Refresh Token")
    ) {
      const allCookies = request.cookies.getAll();
      allCookies.forEach((cookie) => {
        if (cookie.name.startsWith("sb-") && cookie.name.includes("auth")) {
          supabaseResponse.cookies.set(cookie.name, "", {
            path: "/",
            maxAge: 0,
          });
        }
      });
      user = null;
    } else {
      console.error("Unexpected auth error in middleware:", err?.message);
      user = null;
    }
  }

  // Handle email confirmation redirects at root
  const code = request.nextUrl.searchParams.get("code");
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  if ((code || token_hash) && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // Legacy /admin/* routes — redirect everything to /login
  if (pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // /superadmin/* (excluding /superadmin/login) — require authentication
  if (pathname.startsWith("/superadmin") && !pathname.startsWith("/superadmin/login")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/superadmin/login";
      return NextResponse.redirect(url);
    }
    // Super admin identity validation is done in app/superadmin/layout.tsx
    return supabaseResponse;
  }

  // Root route — redirect to /login
  if (pathname === "/") {
    // If authenticated, try to redirect to their company dashboard
    if (user) {
      try {
        // Super admin takes priority
        const { data: superAdmin } = await supabase
          .from("platform_super_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .single();

        if (superAdmin) {
          const url = request.nextUrl.clone();
          url.pathname = "/superadmin/dashboard";
          return NextResponse.redirect(url);
        }

        const { data: membership } = await supabase
          .from("company_users")
          .select("companies(slug)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .single();

        const slug = (membership?.companies as any)?.slug;
        if (slug) {
          const url = request.nextUrl.clone();
          url.pathname = `/${slug}/dashboard`;
          return NextResponse.redirect(url);
        }
      } catch {
        // No active membership — fall through to /login
      }
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If authenticated user visits /login, redirect to appropriate dashboard
  if (pathname === "/login" && user) {
    try {
      // Super admin takes priority
      const { data: superAdmin } = await supabase
        .from("platform_super_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

      if (superAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/superadmin/dashboard";
        return NextResponse.redirect(url);
      }

      const { data: membership } = await supabase
        .from("company_users")
        .select("companies(slug)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .single();

      const slug = (membership?.companies as any)?.slug;
      if (slug) {
        const url = request.nextUrl.clone();
        url.pathname = `/${slug}/dashboard`;
        return NextResponse.redirect(url);
      }
    } catch {
      // No active membership — let them see the login page
    }
  }

  // Public routes (/login, /signup, /auth/*) — always allow through
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return supabaseResponse;
  }

  // All other routes pass through — server components handle auth for /{slug}/*
  return supabaseResponse;
}
