"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { supabase } from "@/lib/supabase/client/browser";
import { toast } from "sonner";
import { toastError } from "@/lib/utils/toast-helpers";

export type Step = 1 | 2 | 3;

export const CANADIAN_PROVINCES = [
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

export const COUNTRIES = [
  { value: "CA", label: "Canada" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "OTHER", label: "Other" },
];

export interface FormData {
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

export function useCompanySignup() {
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
      toastError(error, "Failed to resend email");
    } finally {
      setIsResending(false);
    }
  };

  const companySlugPreview =
    form.companyName.trim().length > 2
      ? form.companyName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      : null;

  return {
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
  };
}
