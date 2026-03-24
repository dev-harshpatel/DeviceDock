import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client/admin';
import { ensureCompanyMember } from '@/lib/supabase/auth-helpers';
import type { CompanyMember } from '@/types/member';
import type { CompanyRole } from '@/types/company';

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
  }

  const auth = await ensureCompanyMember(companyId);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: companyUsers, error } = await supabaseAdmin
    .from('company_users')
    .select('id, user_id, role, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const members = await Promise.all(
    (companyUsers ?? []).map(async (cu) => {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(cu.user_id);
      const meta = (user?.user_metadata ?? {}) as Record<string, string>;
      const member: CompanyMember = {
        membershipId: cu.id,
        userId: cu.user_id,
        email: user?.email ?? '',
        firstName: meta.first_name ?? '',
        lastName: meta.last_name ?? '',
        role: cu.role as CompanyRole,
        status: cu.status as CompanyMember['status'],
        joinedAt: cu.created_at,
      };
      return member;
    }),
  );

  return NextResponse.json({ members });
}
