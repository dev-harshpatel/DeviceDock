"use client";

import { Building2, CheckCircle2, Package, User } from "lucide-react";
import type { FormData, Step } from "@/hooks/use-company-signup";
import { COUNTRIES, CANADIAN_PROVINCES } from "@/hooks/use-company-signup";

interface ReviewRowProps {
  label: string;
  value: string;
}

function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 px-4 py-2.5 text-sm sm:grid-cols-[160px_1fr]">
      <span className="text-muted-foreground leading-snug">{label}</span>
      <span className="font-medium text-foreground break-words leading-snug">{value}</span>
    </div>
  );
}

interface ReviewStepProps {
  form: FormData;
  goToStep: (nextStep: Step, dir: "forward" | "back") => void;
}

export function ReviewStep({ form, goToStep }: ReviewStepProps) {
  return (
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
          {form.businessEmail && <ReviewRow label="Business Email" value={form.businessEmail} />}
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
            value={COUNTRIES.find((c) => c.value === form.country)?.label ?? form.country}
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
          {form.streetAddress && <ReviewRow label="Street Address" value={form.streetAddress} />}
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-primary/5 px-4 py-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          By registering, you confirm that you are an authorized representative of this company and
          agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
