"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useCompanySignup } from "@/hooks/use-company-signup";
import { SignupSplitLayout } from "@/components/signup/SignupSplitLayout";
import { EmailConfirmation } from "@/components/signup/EmailConfirmation";
import { AccountStep } from "@/components/signup/AccountStep";
import { CompanyDetailsStep } from "@/components/signup/CompanyDetailsStep";
import { ReviewStep } from "@/components/signup/ReviewStep";

const STEPS = [
  { id: 1, label: "Account", icon: User },
  { id: 2, label: "Company", icon: Building2 },
  { id: 3, label: "Review", icon: CheckCircle2 },
];

export default function CompanySignup() {
  const {
    step,
    form,
    errors,
    isSubmitting,
    registeredEmail,
    isResending,
    contentRef,
    companySlugPreview,
    update,
    goToStep,
    handleNext,
    handleBack,
    handleSubmit,
    handleResendConfirmation,
  } = useCompanySignup();

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
        <EmailConfirmation
          registeredEmail={registeredEmail}
          isResending={isResending}
          handleResendConfirmation={handleResendConfirmation}
        />
      </SignupSplitLayout>
    );
  }

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

        {/* Step indicator helper */}
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
              {/* Account step */}
              {step === 1 && <AccountStep form={form} errors={errors} update={update} />}

              {/* Company step */}
              {step === 2 && (
                <CompanyDetailsStep
                  form={form}
                  errors={errors}
                  update={update}
                  companySlugPreview={companySlugPreview}
                />
              )}

              {/* Review step */}
              {step === 3 && <ReviewStep form={form} goToStep={goToStep} />}

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
