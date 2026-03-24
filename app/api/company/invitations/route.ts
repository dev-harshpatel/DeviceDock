import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client/admin';
import { ensureCompanyMember } from '@/lib/supabase/auth-helpers';
import type { PendingInvitation } from '@/types/member';
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

  const { data, error } = await supabaseAdmin
    .from('company_invitations')
    .select('id, invitee_email, role_to_assign, expires_at, created_at, token_hash')
    .eq('company_id', companyId)
    .is('consumed_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const invitations: PendingInvitation[] = (data ?? []).map((row) => ({
    id: row.id,
    inviteeEmail: row.invitee_email,
    roleToAssign: row.role_to_assign as CompanyRole,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    inviteUrl: `/invite/${row.token_hash}`,
  }));

  return NextResponse.json({ invitations });
}
