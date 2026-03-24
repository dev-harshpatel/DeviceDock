import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client/admin';
import { ensureSuperAdmin } from '@/lib/supabase/auth-helpers';

export async function GET() {
  const userId = await ensureSuperAdmin();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service role to bypass RLS — super admin sees all companies
  const { data: companies, error } = await supabaseAdmin
    .from('companies')
    .select('id, name, slug, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const companyList = companies ?? [];
  const companyIds = companyList.map((c) => c.id);

  // User counts per company
  const { data: userCounts } = await supabaseAdmin
    .from('company_users')
    .select('company_id')
    .in('company_id', companyIds)
    .eq('status', 'active');

  const countMap: Record<string, number> = {};
  (userCounts ?? []).forEach((row) => {
    countMap[row.company_id] = (countMap[row.company_id] ?? 0) + 1;
  });

  // Owner user_id per company
  const { data: owners } = await supabaseAdmin
    .from('company_users')
    .select('company_id, user_id')
    .in('company_id', companyIds)
    .eq('role', 'owner')
    .eq('status', 'active');

  const ownerMap: Record<string, string> = {};
  (owners ?? []).forEach((o) => {
    ownerMap[o.company_id] = o.user_id;
  });

  // Fetch owner emails via admin client
  const ownerUserIds = Object.values(ownerMap);
  const emailMap: Record<string, string> = {};

  if (ownerUserIds.length > 0) {
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    (authUsers ?? []).forEach((u) => {
      if (ownerUserIds.includes(u.id)) {
        emailMap[u.id] = u.email ?? '';
      }
    });
  }

  const result = companyList.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: c.status,
    createdAt: c.created_at,
    userCount: countMap[c.id] ?? 0,
    ownerEmail: emailMap[ownerMap[c.id]] ?? null,
  }));

  return NextResponse.json({ companies: result });
}
