export type CompanyRole = 'owner' | 'manager' | 'inventory_admin' | 'analyst';
export type MembershipStatus = 'active' | 'invited' | 'suspended';
export type CompanyStatus = 'active' | 'inactive';

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  timezone: string;
  currency: string;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CompanyMembership {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
}

export interface CompanyRegistration {
  id: string;
  company_slug: string;
  company_name: string;
  owner_email: string;
  owner_first_name: string;
  owner_last_name: string;
  owner_phone_code: string;
  owner_phone: string;
  years_in_business: number | null;
  company_website: string | null;
  company_email: string | null;
  company_address: string | null;
  country: string;
  province: string;
  city: string;
  timezone: string;
  currency: string;
  user_id: string | null;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

/** Role hierarchy helpers */
export const ROLE_LABELS: Record<CompanyRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  inventory_admin: 'Inventory Admin',
  analyst: 'Analyst',
};

export const ROLE_ORDER: CompanyRole[] = ['owner', 'manager', 'inventory_admin', 'analyst'];

export function canManageUsers(role: CompanyRole): boolean {
  return role === 'owner';
}

export function canManageInventory(role: CompanyRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'inventory_admin';
}

export function canViewReports(role: CompanyRole): boolean {
  return true; // all roles
}
