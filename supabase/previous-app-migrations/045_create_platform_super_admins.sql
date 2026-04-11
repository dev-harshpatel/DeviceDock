-- Create platform_super_admins table for platform-level super admin access
-- Referenced by src/lib/supabase/auth-helpers.ts isSuperAdmin()

create table if not exists public.platform_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_super_admins enable row level security;

-- Super admins can read their own row (needed for isSuperAdmin check)
create policy "super_admin_select_own_row"
on public.platform_super_admins
for select
to authenticated
using (user_id = auth.uid());
