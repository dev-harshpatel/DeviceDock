import { NextRequest, NextResponse } from 'next/server';
import { logSuperAdminAudit } from '@/lib/superadmin/audit';
import { supabaseAdmin } from '@/lib/supabase/client/admin';
import { ensureCompanyMember } from '@/lib/supabase/auth-helpers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const companyId = request.nextUrl.searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
  }

  const auth = await ensureCompanyMember(companyId, ['owner']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Mark as consumed to cancel it (soft delete)
  const { error } = await supabaseAdmin
    .from('company_invitations')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSuperAdminAudit({
    action: 'invitation.cancelled',
    actorUserId: auth.userId,
    companyId,
    metadata: { invitationId: id },
    request,
    resourceId: id,
    resourceType: 'invitation',
  });

  return NextResponse.json({ ok: true });
}
