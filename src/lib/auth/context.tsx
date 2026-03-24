"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: User | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ user: User | null; session: any }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        // Handle expected unauthenticated states gracefully
        if (
          error &&
          (error.message?.includes("refresh_token_not_found") ||
            error.message?.includes("Auth session missing"))
        ) {
          // No active session - user is not authenticated
          setUser(null);
          await supabase.auth.signOut({ scope: "local" });
        } else if (error) {
          // Unexpected auth errors
          console.error("Auth error:", error.message);
          setUser(null);
        } else {
          setUser(user);
        }
      } catch (error: any) {
        // Handle unexpected errors
        if (error?.message?.includes("refresh_token_not_found")) {
          setUser(null);
        } else {
          console.error("Unexpected auth error:", error?.message);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle TOKEN_REFRESHED and other events
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Normalize \"no account\" / invalid-credentials errors into a clear message
    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      const code = (error as { code?: string }).code?.toLowerCase() ?? "";

      const isInvalidCredentials =
        code === "invalid_credentials" ||
        code === "invalid_login_credentials" ||
        message.includes("invalid login credentials") ||
        message.includes("invalid email or password");

      if (isInvalidCredentials) {
        throw new Error(
          "No account found with this email and password. Please check your details or sign up first."
        );
      }

      throw error;
    }

    // Enforce email confirmation: block unconfirmed users even if Supabase
    // allows it (e.g. when "Confirm Email" is disabled in Auth settings)
    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut({ scope: "local" });
      const err = new Error("Email not confirmed");
      (err as Error & { name?: string }).name = "EmailNotConfirmed";
      throw err;
    }

    return { user: data.user };
  };

  const signUp = async (email: string, password: string) => {
    // First, check via server whether this email already exists.
    // Do not block signup if this pre-check endpoint is temporarily unavailable.
    let emailExists: boolean | null = null;
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const { exists } = await res.json();
        emailExists = Boolean(exists);
      }
    } catch {
      // Fall back to Supabase handling below.
    }

    if (emailExists) {
      throw new Error(
        "An account with this email already exists. Please log in instead."
      );
    }

    // Use the actual browser origin so the email link always matches
    // the domain the user signed up from (works for both b2bmobiles.ca and stoq-bice.vercel.app)
    const getRedirectUrl = () => {
      if (typeof window !== "undefined") {
        return `${window.location.origin}/auth/confirm`;
      }
      // SSR fallback — use env var
      if (process.env.NEXT_PUBLIC_SITE_URL) {
        return `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/auth/confirm`;
      }
      return "http://localhost:3000/auth/confirm";
    };

    const redirectTo = getRedirectUrl();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    // When email confirmation is required:
    // - User IS created (you'll receive email)
    // - Session IS null (no immediate login)
    // - Supabase returns user in data.user even if session is null

    // IMPORTANT: Even if there's an error about session, if user exists, return it
    // The user was successfully created, they just need to confirm email
    if (data?.user) {
      // User was created - return it regardless of error
      // Session will be null if email confirmation is required
      return { user: data.user, session: data.session };
    }

    // If there's an error and no user was created, throw a more helpful message
    if (error) {
      const supabaseCode = (error as any).code ?? "";
      const msg = (error as any).message ?? "";

      if (
        supabaseCode === "user_already_exists" ||
        /already registered/i.test(msg) ||
        /already exists/i.test(msg)
      ) {
        throw new Error(
          "An account with this email already exists. Please log in instead."
        );
      }

      throw error;
    }

    // No user and no error - shouldn't happen
    throw new Error("Failed to create user account");
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPasswordForEmail = async (email: string) => {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
        : "http://localhost:3000";

    // For password recovery, include a custom flow marker so the callback
    // route can distinguish this from normal email confirmation.
    const redirectTo = `${baseUrl}/auth/callback?flow=recovery`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPasswordForEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
