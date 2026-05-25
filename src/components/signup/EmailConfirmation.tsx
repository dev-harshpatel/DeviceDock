"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail } from "lucide-react";

interface EmailConfirmationProps {
  registeredEmail: string;
  isResending: boolean;
  handleResendConfirmation: () => Promise<void>;
}

export function EmailConfirmation({
  registeredEmail,
  isResending,
  handleResendConfirmation,
}: EmailConfirmationProps) {
  return (
    <Card className="w-full">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Check your email</CardTitle>
        <CardDescription>We sent a confirmation link to</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="break-all text-center text-sm font-medium text-foreground">
          {registeredEmail}
        </p>
        <p className="text-center text-sm leading-6 text-muted-foreground">
          Click the link in the email to verify your account and access your dashboard. Check your
          spam folder if you don&apos;t see it.
        </p>
        <Button
          className="w-full"
          variant="outline"
          onClick={handleResendConfirmation}
          disabled={isResending}
        >
          {isResending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Resend confirmation email"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already confirmed?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
