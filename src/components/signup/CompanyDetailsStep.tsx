"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FormData } from "@/hooks/use-company-signup";
import { CANADIAN_PROVINCES, COUNTRIES } from "@/hooks/use-company-signup";

interface CompanyDetailsStepProps {
  form: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  update: (field: keyof FormData, value: string) => void;
  companySlugPreview: string | null;
}

export function CompanyDetailsStep({
  form,
  errors,
  update,
  companySlugPreview,
}: CompanyDetailsStepProps) {
  return (
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
        {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
        {companySlugPreview && (
          <p className="text-xs text-muted-foreground">
            Portal URL:{" "}
            <span className="font-mono text-foreground">/{companySlugPreview}/dashboard</span>
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
          {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
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
          {errors.province && <p className="text-xs text-destructive">{errors.province}</p>}
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
          Postal Address <span className="font-normal text-muted-foreground">(optional)</span>
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
            Years in Business <span className="font-normal text-muted-foreground">(optional)</span>
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
            Business Email <span className="font-normal text-muted-foreground">(optional)</span>
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
          Business Website <span className="font-normal text-muted-foreground">(optional)</span>
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
  );
}
