"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import type { FormData } from "@/hooks/use-company-signup";

interface AccountStepProps {
  form: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  update: (field: keyof FormData, value: string) => void;
}

export function AccountStep({ form, errors, update }: AccountStepProps) {
  return (
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
          {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
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
          {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
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
        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
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
  );
}
