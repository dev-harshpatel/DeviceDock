import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client/admin';
import { ensureSuperAdmin } from '@/lib/supabase/auth-helpers';

interface Params {
  params: Promise<{ companyId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await ensureSuperAdmin();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId } = await params;

  const { data: members, error } = await supabaseAdmin
    .from('company_users')
    .select('id, user_id, role, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const memberList = members ?? [];
  const userIds = memberList.map((m) => m.user_id);

  // Fetch emails via admin client
  const emailMap: Record<string, string> = {};
  const nameMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    (authUsers ?? []).forEach((u) => {
      if (userIds.includes(u.id)) {
        emailMap[u.id] = u.email ?? '';
        nameMap[u.id] = (u.user_metadata?.full_name as string | undefined) ?? '';
      }
    });
  }

  const result = memberList.map((m) => ({
    id: m.id,
    userId: m.user_id,
    email: emailMap[m.user_id] ?? null,
    fullName: nameMap[m.user_id] ?? null,
    role: m.role,
    status: m.status,
    joinedAt: m.created_at,
  }));

  return NextResponse.json({ users: result });
}
