/**
 * Tax calculation utilities for HST/GST and sales tax
 */

import { supabase } from "../supabase/client/browser";

type TaxInfoResult = {
  taxRate: number;
  taxType: string;
  taxRatePercent: number;
};

type TaxRateRow = {
  city: string | null;
  tax_rate: number | string | null;
  tax_type: string | null;
};

const TAX_INFO_CACHE_TTL_MS = 5 * 60 * 1000;
const taxInfoCache = new Map<
  string,
  { value: TaxInfoResult; cachedAtMs: number }
>();

/**
 * Get tax rate for a given location
 * @param country - Country name ('Canada' or 'USA')
 * @param state - State or province name
 * @param city - Optional city name (for city-specific rates)
 * @returns Tax rate as decimal (e.g., 0.13 for 13%)
 */
export async function getTaxRate(
  country: string,
  state: string,
  city?: string | null
): Promise<number> {
  try {
    if (!country || !state) {
      return 0;
    }

    const info = await getTaxInfo(country, state, city);
    return info.taxRate;
  } catch (error) {
    return 0;
  }
}

/**
 * Calculate tax amount from subtotal
 * @param subtotal - Subtotal amount
 * @param taxRate - Tax rate as decimal (e.g., 0.13 for 13%)
 * @returns Tax amount
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100;
}

/**
 * Get tax type (GST, HST, or Sales Tax) for a location
 * @param country - Country name ('Canada' or 'USA')
 * @param state - State or province name
 * @returns Tax type string
 */
export async function getTaxType(
  country: string,
  state: string
): Promise<string> {
  try {
    if (!country || !state) {
      return "Tax";
    }

    const info = await getTaxInfo(country, state, null);
    return info.taxType || (country === "Canada" ? "GST/HST" : "Sales Tax");
  } catch (error) {
    return country === "Canada" ? "GST/HST" : "Sales Tax";
  }
}

/**
 * Get tax rate and type together
 * @param country - Country name
 * @param state - State or province name
 * @param city - Optional city name
 * @returns Object with taxRate (decimal) and taxType (string)
 */
export async function getTaxInfo(
  country: string,
  state: string,
  city?: string | null
): Promise<TaxInfoResult> {
  if (!country || !state) {
    return { taxRate: 0, taxRatePercent: 0, taxType: "Tax" };
  }

  const normalizedCity = city?.trim() ? city.trim() : null;
  const cacheKey = `${country}::${state}::${normalizedCity ?? ""}`;
  const cached = taxInfoCache.get(cacheKey);
  const nowMs = Date.now();

  if (cached && nowMs - cached.cachedAtMs < TAX_INFO_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const orFilter = normalizedCity
      ? `city.eq.${normalizedCity},city.is.null`
      : "city.is.null";

    const { data, error } = await supabase
      .from("tax_rates")
      .select("city,tax_rate,tax_type")
      .eq("country", country)
      .eq("state_province", state)
      .or(orFilter)
      .order("effective_date", { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      const fallbackTaxType = country === "Canada" ? "GST/HST" : "Sales Tax";
      return { taxRate: 0, taxRatePercent: 0, taxType: fallbackTaxType };
    }

    const rows = data as unknown as TaxRateRow[];
    const bestRow = normalizedCity
      ? rows.find((r) => r.city === normalizedCity) ??
        rows.find((r) => r.city === null) ??
        null
      : rows.find((r) => r.city === null) ?? null;

    if (!bestRow) {
      const fallbackTaxType = country === "Canada" ? "GST/HST" : "Sales Tax";
      return { taxRate: 0, taxRatePercent: 0, taxType: fallbackTaxType };
    }

    const ratePercent = Number(bestRow.tax_rate ?? 0);
    const taxRate = Number.isFinite(ratePercent) ? ratePercent / 100 : 0;
    const fallbackTaxType = country === "Canada" ? "GST/HST" : "Sales Tax";
    const taxType = bestRow.tax_type || fallbackTaxType;

    const value: TaxInfoResult = {
      taxRate,
      taxRatePercent: taxRate * 100,
      taxType,
    };

    taxInfoCache.set(cacheKey, { value, cachedAtMs: nowMs });
    return value;
  } catch {
    const fallbackTaxType = country === "Canada" ? "GST/HST" : "Sales Tax";
    return { taxRate: 0, taxRatePercent: 0, taxType: fallbackTaxType };
  }
}
