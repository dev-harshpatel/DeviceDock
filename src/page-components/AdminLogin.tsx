"use client";

import { useState } from "react";
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
import { Loader2, Package } from "lucide-react";

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
      setResetEmailSent(true);
      toast.success(TOAST_MESSAGES.PASSWORD_RESET_EMAIL_SENT);
    } catch (error) {
      const message = error instanceof Error ? error.message : TOAST_MESSAGES.PASSWORD_RESET_FAILED;
      toast.error(message);
    } finally {
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">DeviceDock</CardTitle>
          <CardDescription>Sign in to your inventory portal</CardDescription>
        </CardHeader>
        <CardContent>
          {showEmailNotConfirmed ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Your email address hasn't been confirmed yet. We've sent a confirmation link to{" "}
                <span className="font-medium text-foreground break-all">{email}</span>. Check your
                inbox and spam folder, or request a new link below.
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
                  <p className="text-sm text-muted-foreground text-center">
                    We've sent a password reset link to{" "}
                    <span className="font-medium text-foreground break-all">{email}</span>. Check
                    your inbox and spam folder.
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
  );
}
