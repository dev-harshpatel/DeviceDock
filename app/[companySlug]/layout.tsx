import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/client/server';
import { getCompanyBySlug } from '@/lib/supabase/auth-helpers';
import { CompanyShell } from '@/components/providers/CompanyShell';
import type { CompanyMembership } from '@/types/company';

interface CompanyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ companySlug: string }>;
}

export default async function CompanyLayout({ params, children }: CompanyLayoutProps) {
  const { companySlug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const company = await getCompanyBySlug(companySlug);
  if (!company) redirect('/login');

  const { data: membershipRow, error } = await supabase
    .from('company_users')
    .select('*')
    .eq('user_id', user.id)
    .eq('company_id', company.id)
    .eq('status', 'active')
    .single();

  if (error || !membershipRow) redirect('/login');

  const membership: CompanyMembership = {
    id: membershipRow.id,
    company_id: membershipRow.company_id,
    user_id: membershipRow.user_id,
    role: membershipRow.role,
    status: membershipRow.status,
    created_at: membershipRow.created_at,
    updated_at: membershipRow.updated_at,
  };

  return (
    <CompanyShell company={company} membership={membership}>
      {children}
    </CompanyShell>
  );
}
