"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { supabase } from "@/lib/supabase/client/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Package,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

interface FormData {
  // Step 1 — Account
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  // Step 2 — Company
  companyName: string;
  country: string;
  province: string;
  city: string;
  streetAddress: string;
  yearsInBusiness: string;
  businessEmail: string;
  website: string;
}

const CANADIAN_PROVINCES = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
];

const COUNTRIES = [
  { value: "CA", label: "Canada" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "OTHER", label: "Other" },
];

const STEPS = [
  { id: 1, label: "Account", icon: User },
  { id: 2, label: "Company", icon: Building2 },
  { id: 3, label: "Review", icon: CheckCircle2 },
];

const TRUST_POINTS = [
  "Company-level workspace with isolated access",
  "Structured setup for regional settings and inventory operations",
  "Email verification before dashboard access",
];

interface SignupSplitLayoutProps {
  children: React.ReactNode;
  rightPaneClassName?: string;
}

function SignupSplitLayout({ children, rightPaneClassName }: SignupSplitLayoutProps) {
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
                DeviceDock onboarding
              </div>
              <div className="space-y-3">
                <h2 className="max-w-lg text-4xl font-semibold tracking-tight text-foreground xl:text-5xl">
                  Set up your company workspace with the right defaults.
                </h2>
                <p className="max-w-xl text-base leading-7 text-muted-foreground">
                  Create the admin account, define company details, and review your setup before
                  access is activated.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">What you can expect</p>
            <div className="mt-4 space-y-3">
              {TRUST_POINTS.map((point) => (
                <div key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className={cn("min-h-0 overflow-y-auto", rightPaneClassName)}>
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-start justify-center px-4 py-6 sm:px-6 lg:px-8 lg:py-10 xl:px-10">
          <div className="w-full max-w-3xl space-y-5">{children}</div>
        </div>
      </section>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 px-4 py-2.5 text-sm sm:grid-cols-[160px_1fr]">
      <span className="text-muted-foreground leading-snug">{label}</span>
      <span className="font-medium text-foreground break-words leading-snug">{value}</span>
    </div>
  );
}

export default function CompanySignup() {
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const directionRef = useRef<"forward" | "back">("forward");
  const isFirstMount = useRef(true);

  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    country: "CA",
    province: "ON",
    city: "",
    streetAddress: "",
    yearsInBusiness: "",
    businessEmail: "",
    website: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Animate step content in whenever step changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (!contentRef.current) return;
    const xFrom = directionRef.current === "forward" ? 48 : -48;
    gsap.set(contentRef.current, { x: xFrom, opacity: 0 });
    gsap.to(contentRef.current, {
      x: 0,
      opacity: 1,
      duration: 0.35,
      ease: "power2.out",
    });
  }, [step]);

  const goToStep = (nextStep: Step, dir: "forward" | "back") => {
    if (!contentRef.current) return;
    directionRef.current = dir;
    gsap.killTweensOf(contentRef.current);
    gsap.to(contentRef.current, {
      x: dir === "forward" ? -48 : 48,
      opacity: 0,
      duration: 0.2,
      ease: "power2.in",
      onComplete: () => setStep(nextStep),
    });
  };

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateStep1 = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.firstName.trim()) newErrors.firstName = "First name is required";
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Enter a valid email address";
    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    if (!form.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.companyName.trim()) newErrors.companyName = "Company name is required";
    if (!form.country) newErrors.country = "Country is required";
    if (!form.province) newErrors.province = "Province / State is required";
    if (!form.city.trim()) newErrors.city = "City is required";
    if (form.businessEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.businessEmail.trim()))
      newErrors.businessEmail = "Enter a valid email address";
    if (form.website.trim() && !/^https?:\/\/.+/.test(form.website.trim()))
      newErrors.website = "Enter a valid URL (https://...)";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) goToStep(2, "forward");
    else if (step === 2 && validateStep2()) goToStep(3, "forward");
  };

  const handleBack = () => {
    if (step === 2) goToStep(1, "back");
    else if (step === 3) goToStep(2, "back");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/company-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          companyName: form.companyName.trim(),
          country: form.country,
          province: form.province,
          city: form.city.trim(),
          streetAddress: form.streetAddress.trim(),
          yearsInBusiness: form.yearsInBusiness.trim(),
          businessEmail: form.businessEmail.trim().toLowerCase(),
          website: form.website.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Registration failed. Please try again.");
        if (res.status === 409) {
          if (data.error?.toLowerCase().includes("email")) goToStep(1, "back");
          else if (data.error?.toLowerCase().includes("company")) goToStep(2, "back");
        }
        return;
      }

      setRegisteredEmail(form.email.trim().toLowerCase());
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!registeredEmail) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: registeredEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (error) throw error;
      toast.success("Confirmation email resent! Check your inbox.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resend email";
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  // ── Email confirmation screen ────────────────────────────────────────────
  if (registeredEmail) {
    return (
      <SignupSplitLayout rightPaneClassName="bg-background">
        <div className="space-y-5 lg:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>
        </div>
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
              Click the link in the email to verify your account and access your dashboard. Check
              your spam folder if you don&apos;t see it.
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
      </SignupSplitLayout>
    );
  }

  // ── Step indicator helper ────────────────────────────────────────────────
  const companySlugPreview =
    form.companyName.trim().length > 2
      ? form.companyName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      : null;

  return (
    <SignupSplitLayout rightPaneClassName="bg-background">
      <div className="space-y-4 sm:space-y-5">
        <div className="space-y-4 lg:hidden">
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
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
              Register Your Company
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Create your DeviceDock account in minutes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200",
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : step > s.id
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                <s.icon className="h-3 w-3" />
                {s.label}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <Card className="w-full">
          <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-5">
            <CardTitle className="text-lg">
              {step === 1 && "Your Account"}
              {step === 2 && "Company Details"}
              {step === 3 && "Review & Confirm"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Create your personal login credentials"}
              {step === 2 && "Tell us about your business"}
              {step === 3 && "Review your information before submitting"}
            </CardDescription>
          </CardHeader>

          {/* Clip the sliding content */}
          <CardContent className="overflow-hidden p-5 pt-0 sm:p-6 sm:pt-0">
            <div ref={contentRef} className="space-y-4">
              {/* ── Step 1: Account ── */}
              {step === 1 && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={form.firstName}
                        onChange={(e) => update("firstName", e.target.value)}
                        placeholder="John"
                        className={cn(errors.firstName && "border-destructive")}
                      />
                      {errors.firstName && (
                        <p className="text-xs text-destructive">{errors.firstName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={form.lastName}
                        onChange={(e) => update("lastName", e.target.value)}
                        placeholder="Smith"
                        className={cn(errors.lastName && "border-destructive")}
                      />
                      {errors.lastName && (
                        <p className="text-xs text-destructive">{errors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Work Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="john@company.com"
                      autoComplete="email"
                      className={cn(errors.email && "border-destructive")}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <PasswordInput
                      id="password"
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className={cn(errors.password && "border-destructive")}
                    />
                    {errors.password && (
                      <p className="text-xs text-destructive">{errors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <PasswordInput
                      id="confirmPassword"
                      value={form.confirmPassword}
                      onChange={(e) => update("confirmPassword", e.target.value)}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      className={cn(errors.confirmPassword && "border-destructive")}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>
                </>
              )}

              {/* ── Step 2: Company Details ── */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Business Name */}
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Business Name</Label>
                    <Input
                      id="companyName"
                      value={form.companyName}
                      onChange={(e) => update("companyName", e.target.value)}
                      placeholder="e.g. Acme Electronics Inc."
                      className={cn(errors.companyName && "border-destructive")}
                    />
                    {errors.companyName && (
                      <p className="text-xs text-destructive">{errors.companyName}</p>
                    )}
                    {companySlugPreview && (
                      <p className="text-xs text-muted-foreground">
                        Portal URL:{" "}
                        <span className="font-mono text-foreground">
                          /{companySlugPreview}/dashboard
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Country + Province/State */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select
                        value={form.country}
                        onValueChange={(v) => {
                          update("country", v);
                          if (v !== "CA") update("province", "");
                        }}
                      >
                        <SelectTrigger className={cn(errors.country && "border-destructive")}>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.country && (
                        <p className="text-xs text-destructive">{errors.country}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="province">Province / State</Label>
                      {form.country === "CA" ? (
                        <Select value={form.province} onValueChange={(v) => update("province", v)}>
                          <SelectTrigger className={cn(errors.province && "border-destructive")}>
                            <SelectValue placeholder="Select province" />
                          </SelectTrigger>
                          <SelectContent>
                            {CANADIAN_PROVINCES.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="province"
                          value={form.province}
                          onChange={(e) => update("province", e.target.value)}
                          placeholder="State / Province"
                          className={cn(errors.province && "border-destructive")}
                        />
                      )}
                      {errors.province && (
                        <p className="text-xs text-destructive">{errors.province}</p>
                      )}
                    </div>
                  </div>

                  {/* City */}
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                      placeholder="Toronto"
                      className={cn(errors.city && "border-destructive")}
                    />
                    {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
                  </div>

                  {/* Postal Address */}
                  <div className="space-y-2">
                    <Label htmlFor="streetAddress">
                      Postal Address{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="streetAddress"
                      value={form.streetAddress}
                      onChange={(e) => update("streetAddress", e.target.value)}
                      placeholder="123 Main St, Suite 400"
                    />
                  </div>

                  {/* Years in Business + Business Email */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="yearsInBusiness">
                        Years in Business{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="yearsInBusiness"
                        type="number"
                        min="0"
                        max="500"
                        value={form.yearsInBusiness}
                        onChange={(e) => update("yearsInBusiness", e.target.value)}
                        placeholder="e.g. 5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessEmail">
                        Business Email{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="businessEmail"
                        type="email"
                        value={form.businessEmail}
                        onChange={(e) => update("businessEmail", e.target.value)}
                        placeholder="info@company.com"
                        className={cn(errors.businessEmail && "border-destructive")}
                      />
                      {errors.businessEmail && (
                        <p className="text-xs text-destructive">{errors.businessEmail}</p>
                      )}
                    </div>
                  </div>

                  {/* Business Website */}
                  <div className="space-y-2">
                    <Label htmlFor="website">
                      Business Website{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      value={form.website}
                      onChange={(e) => update("website", e.target.value)}
                      placeholder="https://example.com"
                      className={cn(errors.website && "border-destructive")}
                    />
                    {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
                  </div>
                </div>
              )}

              {/* ── Step 3: Review ── */}
              {step === 3 && (
                <div className="space-y-3">
                  {/* Account section */}
                  <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/50">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Account
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(1, "back")}
                        className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                        aria-label="Edit account details"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="divide-y divide-border/60">
                      <ReviewRow label="Full Name" value={`${form.firstName} ${form.lastName}`} />
                      <ReviewRow label="Email" value={form.email} />
                      <ReviewRow label="Password" value="••••••••" />
                    </div>
                  </div>

                  {/* Company section */}
                  <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/50">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Company
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(2, "back")}
                        className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                        aria-label="Edit company details"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="divide-y divide-border/60">
                      <ReviewRow label="Business Name" value={form.companyName} />
                      {form.businessEmail && (
                        <ReviewRow label="Business Email" value={form.businessEmail} />
                      )}
                      {form.website && <ReviewRow label="Website" value={form.website} />}
                      {form.yearsInBusiness && (
                        <ReviewRow
                          label="Years in Business"
                          value={`${form.yearsInBusiness} yr${Number(form.yearsInBusiness) !== 1 ? "s" : ""}`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Address section */}
                  <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/50">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                          <Package className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Location
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(2, "back")}
                        className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                        aria-label="Edit location details"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="divide-y divide-border/60">
                      <ReviewRow
                        label="Country"
                        value={
                          COUNTRIES.find((c) => c.value === form.country)?.label ?? form.country
                        }
                      />
                      <ReviewRow
                        label="Province / State"
                        value={
                          form.country === "CA"
                            ? (CANADIAN_PROVINCES.find((p) => p.value === form.province)?.label ??
                              form.province)
                            : form.province
                        }
                      />
                      <ReviewRow label="City" value={form.city} />
                      {form.streetAddress && (
                        <ReviewRow label="Street Address" value={form.streetAddress} />
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-primary/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      By registering, you confirm that you are an authorized representative of this
                      company and agree to our terms of service.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-2 pt-2">
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                {step < 3 ? (
                  <Button type="button" onClick={handleNext} className="flex-1">
                    Continue
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating your account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                )}
              </div>

              {step === 1 && (
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="text-primary hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SignupSplitLayout>
  );
}
