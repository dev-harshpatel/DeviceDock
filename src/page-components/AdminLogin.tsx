"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { supabase } from "@/lib/supabase/client/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { ArrowLeft, BadgeCheck, Loader2, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const LOGIN_TRUST_POINTS = [
  "Multi-tenant workspace — your data stays isolated",
  "Role-based access for owners, managers, and staff",
  "Real-time inventory sync across your entire team",
];

interface LoginSplitLayoutProps {
  children: React.ReactNode;
}

function LoginSplitLayout({ children }: LoginSplitLayoutProps) {
  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden bg-background lg:grid-cols-[minmax(20rem,0.88fr)_minmax(36rem,1.12fr)] xl:grid-cols-[minmax(22rem,0.84fr)_minmax(40rem,1.16fr)]">
      <aside className="relative hidden overflow-hidden border-r border-border/60 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.22),transparent_34%),linear-gradient(155deg,hsl(var(--background)),hsl(var(--muted))_58%,hsl(var(--background)))] dark:bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.28),transparent_34%),linear-gradient(155deg,hsl(224_30%_13%),hsl(240_16%_9%)_60%,hsl(240_18%_8%))]" />
        <div className="absolute inset-y-10 right-[-10%] w-2/3 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>

          <div className="max-w-lg space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
                <Package className="h-3.5 w-3.5 text-primary" />
                DeviceDock portal
              </div>
              <div className="space-y-3">
                <h2 className="max-w-lg text-4xl font-semibold tracking-tight text-foreground xl:text-5xl">
                  Welcome back to your inventory workspace.
                </h2>
                <p className="max-w-xl text-base leading-7 text-muted-foreground">
                  Sign in to manage inventory, track orders, and collaborate with your team — all in
                  one place.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Everything you need</p>
            <div className="mt-4 space-y-3">
              {LOGIN_TRUST_POINTS.map((point) => (
                <div key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className="min-h-0 overflow-y-auto bg-background">
        <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center px-4 py-10 sm:px-6">
          {children}
        </div>
      </section>
    </div>
  );
}

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEmailNotConfirmed, setShowEmailNotConfirmed] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { signIn, signOut, resetPasswordForEmail } = useAuth();
  const router = useRouter();

  // When Supabase sends a recovery email and the Site URL points to /login,
  // the reset link may land here in two formats. Detect both and forward to
  // the correct handler so the user reaches the reset-password page.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const tokenHash = searchParams.get("token_hash");
    const queryType = searchParams.get("type");

    // Hash-based implicit flow: #access_token=...&type=recovery
    if (hash.includes("type=recovery") && hash.includes("access_token=")) {
      router.replace(`/auth/confirm${hash}`);
      return;
    }

    // Token-hash query param flow: ?token_hash=xxx&type=recovery
    // Forward to server-side callback which verifies the OTP and redirects correctly.
    if (tokenHash && queryType === "recovery") {
      router.replace(`/auth/callback?${searchParams.toString()}`);
    }
  }, [router]);

  const handleResendConfirmation = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      toast.success("Confirmation email sent! Please check your inbox.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resend email";
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSendingReset(true);
    try {
      await resetPasswordForEmail(email.trim());
    } catch (error) {
      // Keep a generic response for forgot-password to avoid account enumeration.
      console.error("[Forgot Password] reset request error:", error);
    } finally {
      setResetEmailSent(true);
      toast.success(TOAST_MESSAGES.PASSWORD_RESET_EMAIL_SENT);
      setIsSendingReset(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { user: loggedInUser } = await signIn(email, password);

      if (loggedInUser) {
        // Find the user's active company membership
        const { data: membership } = await supabase
          .from("company_users")
          .select("companies(slug)")
          .eq("user_id", loggedInUser.id)
          .eq("status", "active")
          .limit(1)
          .single();

        const row = membership as { companies: { slug: string } | null } | null;
        const slug = row?.companies?.slug;

        if (slug) {
          toast.success(TOAST_MESSAGES.LOGIN_SUCCESS);
          router.push(`/${slug}/dashboard`);
        } else {
          // No active company membership
          await signOut();
          toast.error(
            "No active company found for your account. Please contact your administrator.",
          );
          setPassword("");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : TOAST_MESSAGES.LOGIN_FAILED;
      if (
        error instanceof Error &&
        (error.message.toLowerCase().includes("email not confirmed") ||
          error.message.toLowerCase().includes("email_not_confirmed"))
      ) {
        setShowEmailNotConfirmed(true);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginSplitLayout>
      <div className="w-full space-y-5">
        {/* Mobile back link */}
        <div className="lg:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>
        </div>

        <div className="space-y-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">DeviceDock</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Sign in to your inventory portal
            </p>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-5">
            <CardTitle className="text-lg">
              {showEmailNotConfirmed
                ? "Confirm your email"
                : showForgotPassword
                  ? "Reset password"
                  : "Sign in"}
            </CardTitle>
            <CardDescription>
              {showEmailNotConfirmed
                ? "Your email address needs to be verified"
                : showForgotPassword
                  ? "We'll send a reset link to your email"
                  : "Enter your credentials to access your workspace"}
            </CardDescription>
          </CardHeader>
          <CardContent className={cn("p-5 pt-0 sm:p-6 sm:pt-0")}>
            {showEmailNotConfirmed ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your email address hasn&apos;t been confirmed yet. We&apos;ve sent a confirmation
                  link to <span className="font-medium text-foreground break-all">{email}</span>.
                  Check your inbox and spam folder, or request a new link below.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                    className="w-full"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Resend Confirmation Email"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowEmailNotConfirmed(false)}
                    className="w-full"
                  >
                    Back to Sign In
                  </Button>
                </div>
              </div>
            ) : showForgotPassword ? (
              <div className="space-y-4">
                {resetEmailSent ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      If an account exists for{" "}
                      <span className="font-medium text-foreground break-all">{email}</span>. Check
                      your inbox and spam folder for a password reset link.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResetEmailSent(false);
                        setShowForgotPassword(false);
                      }}
                      className="w-full"
                    >
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        disabled={isSendingReset}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button type="submit" className="w-full" disabled={isSendingReset}>
                        {isSendingReset ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send Reset Link"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowForgotPassword(false)}
                        className="w-full"
                      >
                        Back to Sign In
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  New to DeviceDock?{" "}
                  <Link href="/signup" className="text-primary hover:underline font-medium">
                    Register your company
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </LoginSplitLayout>
  );
}
