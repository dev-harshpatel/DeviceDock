"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

function ResendConfirmationForm() {
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

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
      setSent(true);
      toast.success("Confirmation email sent!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send email";
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">Confirmation email sent!</p>
        </div>
        <p className="text-sm text-muted-foreground">
          We've sent a new confirmation link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Please
          check your inbox and spam folder.
        </p>
        <p className="text-xs text-muted-foreground border border-border rounded-md p-2 bg-muted/30">
          Not receiving it? Supabase's default email has strict limits. Your
          admin may need to configure custom SMTP in Supabase Dashboard → Auth →
          SMTP Settings. See{" "}
          <a
            href="https://supabase.com/docs/guides/auth/auth-smtp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Supabase SMTP docs
          </a>
          .
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

function AuthCodeErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Authentication Error</CardTitle>
          </div>
          <CardDescription>
            {reason === "redirect_mismatch"
              ? "There was a problem verifying your email"
              : "Your verification link may have expired or is invalid"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason === "redirect_mismatch" ? (
            <p className="text-sm text-muted-foreground">
              The email confirmation link was generated for a different URL.
              Ensure Supabase Dashboard → Auth → URL Configuration has the
              correct Site URL and Redirect URLs for this domain. Try signing up
              again or contact support if the issue persists.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This can happen if the link has expired (links are valid for 24
                hours) or has already been used. You can request a new
                confirmation email below.
              </p>
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-1">
                  Resend confirmation email
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Enter the email you signed up with and we'll send a new link.
                </p>
                <ResendConfirmationForm />
              </div>
            </>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="flex-1"
            >
              Go Home
            </Button>
          </div>
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
