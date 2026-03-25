"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client/browser";

const getHashParams = () => {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
};

const getPostAuthDestination = async (): Promise<string> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "/login";
  }

  const superAdminResult = await supabase
    .from("platform_super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const superAdminData = superAdminResult.data as {
    user_id: string;
  } | null;
  if (superAdminData?.user_id) {
    return "/superadmin/dashboard";
  }

  const membershipResult = await supabase
    .from("company_users")
    .select("companies(slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (membershipResult.error) {
    console.warn("[auth/confirm] membership lookup failed:", membershipResult.error.message);
    return "/login";
  }

  const membershipData = membershipResult.data as {
    companies: { slug: string } | null;
  };
  const slug = membershipData.companies?.slug;

  if (!slug) {
    return "/login";
  }

  return `/${slug}/dashboard`;
};

export default function AuthConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const handleConfirmation = async () => {
      try {
        const url = new URL(window.location.href);
        const searchParams = url.searchParams;
        const code = searchParams.get("code");
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        const flow = searchParams.get("flow");
        const hashParams = getHashParams();
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        console.log("[auth/confirm] received callback:", {
          hasAccessToken: Boolean(accessToken),
          hasCode: Boolean(code),
          hasRefreshToken: Boolean(refreshToken),
          hasTokenHash: Boolean(tokenHash),
          type,
        });

        // If Supabase sent code/token_hash in query, let the server callback route handle it.
        if ((code || tokenHash) && isMounted) {
          router.replace(`/auth/callback?${searchParams.toString()}`);
          return;
        }

        // Handle implicit/hash flow links (#access_token=...).
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("[auth/confirm] setSession error:", error.message);
            if (isMounted) {
              router.replace("/auth/auth-code-error?reason=otp_expired");
            }
            return;
          }

          const destination = await getPostAuthDestination();
          if (isMounted) {
            // Clear URL hash/history noise after successful verification.
            window.history.replaceState({}, "", "/auth/confirm");
            router.replace(destination);
          }
          return;
        }

        // Recovery links should still go through server route.
        if (flow === "recovery" && isMounted) {
          router.replace("/auth/callback?flow=recovery");
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (isMounted) {
            router.replace("/auth/auth-code-error?reason=otp_expired");
          }
          return;
        }

        const destination = await getPostAuthDestination();
        if (isMounted) {
          router.replace(destination);
        }
      } catch (error) {
        console.error("[auth/confirm] unexpected error:", error);
        if (isMounted) {
          router.replace("/auth/auth-code-error");
        }
      }
    };

    void handleConfirmation();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verifying your email...
      </div>
    </div>
  );
}
