"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase/client/browser";
import { ROLE_LABELS } from "@/types/company";
import type { CompanyRole } from "@/types/company";

interface AcceptInviteProps {
  token: string;
  inviteeEmail: string;
  role: string;
  companyName: string;
  companySlug: string;
  expired: boolean;
  alreadyUsed: boolean;
}

export default function AcceptInvite({
  token,
  inviteeEmail,
  role,
  companyName,
  companySlug,
  expired,
  alreadyUsed,
}: AcceptInviteProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Create the account via the API
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mode: "signup", firstName, lastName, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to accept invitation");
        return;
      }

      // Step 2: Sign in with the newly created credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteeEmail,
        password,
      });

      if (signInError) {
        // Account was created but sign-in failed; send to login
        toast.success(`Welcome to ${companyName}! Please sign in to continue.`);
        router.push("/login");
        return;
      }

      toast.success(`Welcome to ${companyName}!`);
      router.push(`/${data.slug}/dashboard`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInPassword) {
      toast.error("Please enter your password");
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Sign in first so the session cookie is set
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteeEmail,
        password: signInPassword,
      });

      if (signInError) {
        toast.error("Invalid password. Please try again.");
        return;
      }

      // Step 2: Accept the invitation (API reads user from session cookie)
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mode: "signin" }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to accept invitation");
        return;
      }

      toast.success(`Welcome to ${companyName}!`);
      router.push(`/${data.slug}/dashboard`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Invalid invite states ---

  if (alreadyUsed) {
    return (
      <InvalidInviteScreen
        icon="✅"
        title="Invitation Already Used"
        message="This invitation has already been accepted. If you have an account, sign in to access your company dashboard."
        action={{ label: "Go to Sign In", href: "/login" }}
      />
    );
  }

  if (expired) {
    return (
      <InvalidInviteScreen
        icon="⏰"
        title="Invitation Expired"
        message="This invitation has expired. Please ask your administrator to send a new invitation."
      />
    );
  }

  // --- Main accept form ---

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">You&apos;re invited!</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Join <span className="font-semibold text-foreground">{companyName}</span> as{" "}
              <span className="font-semibold text-foreground">
                {ROLE_LABELS[role as CompanyRole] ?? role}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Invite sent to: <span className="font-mono text-foreground">{inviteeEmail}</span>
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Tabs defaultValue="signup">
            <TabsList className="w-full mb-5">
              <TabsTrigger value="signup" className="flex-1">
                New Account
              </TabsTrigger>
              <TabsTrigger value="signin" className="flex-1">
                Existing Account
              </TabsTrigger>
            </TabsList>

            {/* Create new account */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={inviteeEmail} disabled className="bg-muted text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating Account…" : "Accept & Create Account"}
                </Button>
              </form>
            </TabsContent>

            {/* Sign in with existing account */}
            <TabsContent value="signin">
              <form onSubmit={handleSignin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={inviteeEmail} disabled className="bg-muted text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signInPassword">Password</Label>
                  <PasswordInput
                    id="signInPassword"
                    placeholder="Your existing password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Joining…" : "Sign In & Accept Invitation"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

interface InvalidInviteScreenProps {
  icon: string;
  title: string;
  message: string;
  action?: { label: string; href: string };
}

function InvalidInviteScreen({ icon, title, message, action }: InvalidInviteScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="text-5xl">{icon}</div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
        {action && (
          <a
            href={action.href}
            className="inline-block mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {action.label}
          </a>
        )}
      </div>
    </div>
  );
}
