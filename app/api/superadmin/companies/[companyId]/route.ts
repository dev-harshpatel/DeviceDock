import { NextRequest, NextResponse } from 'next/server';
import { logSuperAdminAudit } from '@/lib/superadmin/audit';
import { supabaseAdmin } from '@/lib/supabase/client/admin';
import { ensureSuperAdmin } from '@/lib/supabase/auth-helpers';

interface Params {
  params: Promise<{ companyId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await ensureSuperAdmin();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId } = await params;

  const { data: company, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  return NextResponse.json({ company });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await ensureSuperAdmin();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId } = await params;
  const body = await req.json() as { status?: string };

  if (!body.status || !['active', 'suspended', 'inactive'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
  }

  const { data: currentCompany } = await supabaseAdmin
    .from('companies')
    .select('id, name, status')
    .eq('id', companyId)
    .single();

  const { data, error } = await supabaseAdmin
    .from('companies')
    .update({ status: body.status, updated_at: new Date().toISOString() } as never)
    .eq('id', companyId)
    .select('id, name, slug, status')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSuperAdminAudit({
    action: 'company.status_updated',
    actorUserId: userId,
    companyId,
    metadata: {
      companyName: data.name,
      newStatus: data.status,
      previousStatus: currentCompany?.status ?? null,
    },
    request: req,
    resourceId: companyId,
    resourceType: 'company',
  });

  return NextResponse.json({ company: data });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await ensureSuperAdmin();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId } = await params;

  // 1. Fetch company + all member user_ids before deletion
  const { data: company, error: fetchError } = await supabaseAdmin
    .from('companies')
    .select('id, slug, name')
    .eq('id', companyId)
    .single();

  if (fetchError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const { data: members } = await supabaseAdmin
    .from('company_users')
    .select('user_id')
    .eq('company_id', companyId);

  const memberUserIds = (members ?? []).map((m) => m.user_id);

  // 2. Delete company_registrations (no FK cascade — uses company_slug)
  await supabaseAdmin
    .from('company_registrations')
    .delete()
    .eq('company_slug', company.slug);

  // 3. Delete the companies row — cascades to:
  //    inventory, orders, company_users, company_invitations,
  //    company_user_feature_overrides (via company_users)
  const { error: deleteError } = await supabaseAdmin
    .from('companies')
    .delete()
    .eq('id', companyId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // 4. Delete auth users who belonged to this company
  const deleteResults = await Promise.allSettled(
    memberUserIds.map((uid) => supabaseAdmin.auth.admin.deleteUser(uid))
  );

  const failedDeletes = deleteResults.filter((r) => r.status === 'rejected').length;
  if (failedDeletes > 0) {
    console.warn(`[delete-company] ${failedDeletes} auth user(s) could not be deleted for company ${companyId}`);
  }

  await logSuperAdminAudit({
    action: 'company.deleted',
    actorUserId: userId,
    companyId,
    metadata: {
      companyName: company.name,
      deletedUsers: memberUserIds.length,
      failedUserDeletes: failedDeletes,
      slug: company.slug,
    },
    request: req,
    resourceId: companyId,
    resourceType: 'company',
  });

  return NextResponse.json({ success: true, deletedUsers: memberUserIds.length });
}
