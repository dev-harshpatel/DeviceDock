import { supabase } from "@/lib/supabase/client/browser";

const RESERVED_SLUGS = new Set([
  "login",
  "signup",
  "superadmin",
  "invite",
  "auth",
  "api",
  "not-found",
  "_next",
  "admin",
  "static",
  "public",
]);

/**
 * Convert a company name to a URL-safe slug.
 * e.g. "Acme Electronics Ltd." → "acme-electronics-ltd"
 */
export function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // strip non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/**
 * Check whether a slug is reserved (blocked from registration).
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Check whether a slug is available in the companies table.
 * Server-side: pass the supabaseAdmin client.
 * Client-side: uses the browser anon client (RLS will still let us check uniqueness).
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (isReservedSlug(slug)) return false;

  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug);

  if (error) return false;
  return (count ?? 0) === 0;
}
