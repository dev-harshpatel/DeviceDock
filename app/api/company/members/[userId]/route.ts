import { NextRequest, NextResponse } from 'next/server';
import { logSuperAdminAudit } from '@/lib/superadmin/audit';
import { supabaseAdmin } from '@/lib/supabase/client/admin';
import { ensureCompanyMember } from '@/lib/supabase/auth-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const body = await request.json();
  const { companyId, role, status } = body as {
    companyId: string;
    role?: string;
    status?: string;
  };

  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
  }

  const auth = await ensureCompanyMember(companyId, ['owner']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (userId === auth.userId) {
    return NextResponse.json({ error: 'Cannot modify your own membership' }, { status: 400 });
  }

  const update: Record<string, string> = { updated_at: new Date().toISOString() };
  if (role) update.role = role;
  if (status) update.status = status;

  const { error } = await supabaseAdmin
    .from('company_users')
    .update(update)
    .eq('user_id', userId)
    .eq('company_id', companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Determine the specific action for audit purposes
  const auditAction = role
    ? 'member.role_changed'
    : status === 'suspended'
    ? 'member.suspended'
    : 'member.reactivated';

  await logSuperAdminAudit({
    action: auditAction,
    actorUserId: auth.userId,
    companyId,
    metadata: { targetUserId: userId, ...(role ? { newRole: role } : { newStatus: status }) },
    request,
    resourceId: userId,
    resourceType: 'member',
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const companyId = request.nextUrl.searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
  }

  const auth = await ensureCompanyMember(companyId, ['owner']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (userId === auth.userId) {
    return NextResponse.json({ error: 'Cannot remove yourself from the company' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('company_users')
    .delete()
    .eq('user_id', userId)
    .eq('company_id', companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSuperAdminAudit({
    action: 'member.removed',
    actorUserId: auth.userId,
    companyId,
    metadata: { targetUserId: userId },
    request,
    resourceId: userId,
    resourceType: 'member',
  });

  return NextResponse.json({ ok: true });
}
