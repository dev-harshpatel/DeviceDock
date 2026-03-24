/**
 * Server-side auth helpers — import only in Server Components, Route Handlers, or Middleware.
 * Never import in client components.
 */

import { createClient } from '@/lib/supabase/client/server';
import type { Company, CompanyMembership, CompanyRole } from '@/types/company';

export interface UserMembership {
  company: Company;
  membership: CompanyMembership;
}

/**
 * Fetch company by slug. Returns null if not found.
 */
export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error || !data) return null;
  return data as Company;
}

/**
 * Fetch the active company membership for a user.
 * Returns the first active membership found (users typically belong to one company).
 * Returns null if user has no active membership.
 */
export async function getUserMembership(userId: string): Promise<UserMembership | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('company_users')
    .select('*, companies(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error || !data) return null;

  const row = data as any;
  if (!row.companies) return null;

  return {
    company: row.companies as Company,
    membership: {
      id: row.id,
      company_id: row.company_id,
      user_id: row.user_id,
      role: row.role,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as CompanyMembership,
  };
}

/**
 * Check if a user is a platform super admin.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('platform_super_admins')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

/**
 * Ensure the current request is from a super admin.
 * Returns the userId if valid, null otherwise.
 * Use in API route handlers to guard superadmin endpoints.
 */
export async function ensureSuperAdmin(): Promise<string | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const ok = await isSuperAdmin(user.id);
  return ok ? user.id : null;
}

/**
 * Ensure the current request is from an active member of the given company.
 * Optionally restrict to specific roles.
 * Returns { userId, role } if authorized, null otherwise.
 */
export async function ensureCompanyMember(
  companyId: string,
  allowedRoles?: CompanyRole[],
): Promise<{ userId: string; role: CompanyRole } | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  let query = supabase
    .from('company_users')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (allowedRoles?.length) {
    query = (query as any).in('role', allowedRoles);
  }

  const { data } = await (query as any).single();
  if (!data) return null;

  return { userId: user.id, role: data.role as CompanyRole };
}

/**
 * Get the current authenticated user from Supabase.
 * Returns null if unauthenticated.
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
