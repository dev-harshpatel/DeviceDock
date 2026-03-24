import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/client/server';
import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout';

export default async function SuperAdminAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/superadmin/login');

  const { data: superAdmin } = await supabase
    .from('platform_super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (!superAdmin) redirect('/superadmin/login');

  return <SuperAdminLayout>{children}</SuperAdminLayout>;
}
