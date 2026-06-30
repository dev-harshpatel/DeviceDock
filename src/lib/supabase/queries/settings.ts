/**
 * Company settings queries
 * Centralized database query functions for company_settings table
 */

import { supabase } from "../client/browser";

export interface CompanySettings {
  company_name: string | null;
  company_address: string | null;
  hst_number: string | null;
  logo_url: string | null;
}

/**
 * Fetches company settings for a given company_id.
 */
export async function fetchCompanySettings(companyId: string): Promise<CompanySettings | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("company_settings") as any)
    .select("company_name, company_address, hst_number, logo_url")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[fetchCompanySettings] failed:", error);
    throw error;
  }

  return data as CompanySettings | null;
}

/**
 * Upserts company settings logo.
 */
export async function upsertCompanyLogo(companyId: string, logoUrl: string | null): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("company_settings") as any).upsert(
    { company_id: companyId, logo_url: logoUrl },
    { onConflict: "company_id" },
  );

  if (error) {
    console.error("[upsertCompanyLogo] failed:", error);
    throw error;
  }
}

/**
 * Upserts general company details.
 */
export async function upsertCompanyProfile(
  companyId: string,
  payload: {
    companyName: string;
    companyAddress: string;
    hstNumber: string;
  },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("company_settings") as any).upsert(
    {
      company_id: companyId,
      company_name: payload.companyName,
      company_address: payload.companyAddress,
      hst_number: payload.hstNumber,
    },
    { onConflict: "company_id" },
  );

  if (error) {
    console.error("[upsertCompanyProfile] failed:", error);
    throw error;
  }
}

/**
 * Upserts notification settings.
 */
export async function upsertCompanyNotificationSettings(
  companyId: string,
  payload: {
    pushNotificationsEnabled: boolean;
    lowStockThreshold: number;
    criticalStockThreshold: number;
  },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("company_settings") as any).upsert(
    {
      company_id: companyId,
      push_notifications_enabled: payload.pushNotificationsEnabled,
      low_stock_threshold: payload.lowStockThreshold,
      critical_stock_threshold: payload.criticalStockThreshold,
    },
    { onConflict: "company_id" },
  );

  if (error) {
    console.error("[upsertCompanyNotificationSettings] failed:", error);
    throw error;
  }
}
