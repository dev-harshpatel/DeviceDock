"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

// ---------- Recovery (password reset) resend form ----------

function RecoveryResendForm() {
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsResending(true);
    try {
      const baseUrl = window.location.origin;
      const redirectTo = `${baseUrl}/auth/callback?flow=recovery`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) throw error;

      setSent(true);
    } catch (error) {
      console.error("[RecoveryResend] error:", error);
      // Always show generic success to avoid account enumeration
    } finally {
      setIsResending(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">Reset link sent!</p>
        </div>
        <p className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, a
          new password reset link has been sent. Please check your inbox and spam folder.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
        >
          Try a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleResend} className="space-y-3 pt-2">
      <div className="space-y-2">
        <Label htmlFor="recovery-email">Email address</Label>
        <Input
          id="recovery-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          disabled={isResending}
          autoComplete="email"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isResending}>
        {isResending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4 mr-2" />
            Send New Reset Link
          </>
        )}
      </Button>
    </form>
  );
}

// ---------- Signup confirmation resend form ----------

function SignupResendForm() {
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send email";
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">Confirmation email sent!</p>
        </div>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a new confirmation link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Please check your inbox and
          spam folder.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
        >
          Send to a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleResend} className="space-y-3 pt-2">
      <div className="space-y-2">
        <Label htmlFor="resend-email">Email address</Label>
        <Input
          id="resend-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          disabled={isResending}
          autoComplete="email"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isResending}>
        {isResending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="h-4 w-4 mr-2" />
            Resend Confirmation Email
          </>
        )}
      </Button>
    </form>
  );
}

// ---------- Main error page ----------

function AuthCodeErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const flow = searchParams.get("flow");

  const isRecoveryFlow = flow === "recovery";
  const isRedirectMismatch = reason === "redirect_mismatch";

  if (isRecoveryFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Reset Link Expired</CardTitle>
            </div>
            <CardDescription>
              This password reset link has expired or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Password reset links are single-use and expire after a short period. Enter your email
              below and we&apos;ll send you a fresh one.
            </p>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-1">Request a new reset link</p>
              <p className="text-xs text-muted-foreground mb-3">
                Enter the email address associated with your account.
              </p>
              <RecoveryResendForm />
            </div>
            <Button onClick={() => router.push("/login")} variant="outline" className="w-full">
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Verification Failed</CardTitle>
          </div>
          <CardDescription>
            {isRedirectMismatch
              ? "There was a problem verifying your email"
              : "Your verification link has expired or is invalid"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRedirectMismatch ? (
            <p className="text-sm text-muted-foreground">
              The confirmation link was generated for a different domain. Please try signing up
              again. If the issue persists, contact support.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Confirmation links expire after 24 hours or become invalid once used. You can
                request a new one below.
              </p>
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-1">
                  Resend confirmation email
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Enter the email you signed up with and we&apos;ll send a new link.
                </p>
                <SignupResendForm />
              </div>
            </>
          )}
          <Button onClick={() => router.push("/")} variant="outline" className="w-full">
            Go Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCodeErrorContent />
    </Suspense>
  );
}
