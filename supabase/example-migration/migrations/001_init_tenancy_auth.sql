-- Tenancy + Auth activation baseline
-- Run this migration once in Supabase. Add later additive migrations for further features.

create extension if not exists "pgcrypto";

-- Platform-level super admin membership
create table if not exists public.platform_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_super_admins enable row level security;

create policy "super_admin_select_own_row"
on public.platform_super_admins
for select
to authenticated
using (user_id = auth.uid());

-- Tenant companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  timezone text not null default 'UTC',
  currency text not null default 'USD',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tenant memberships
create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'inventory_admin', 'analyst')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

alter table public.company_users enable row level security;

-- Allow each user to read only their own membership row (active or not).
create policy "company_users_select_own_rows"
on public.company_users
for select
to authenticated
using (user_id = auth.uid());

-- Block direct writes from clients; activation and invitations are performed server-side with service role.
create policy "company_users_no_public_write"
on public.company_users
for insert
to authenticated
with check (false);

create policy "company_users_no_public_update"
on public.company_users
for update
to authenticated
using (false);

-- Company registration tokens (email verification)
create table if not exists public.company_registrations (
  id uuid primary key default gen_random_uuid(),
  company_slug text not null,
  company_name text not null,
  owner_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.company_registrations enable row level security;

create policy "company_registrations_no_public_read"
on public.company_registrations
for select
to authenticated
using (false);

create policy "company_registrations_no_public_write"
on public.company_registrations
for all
to authenticated
using (false)
with check (false);

-- Employee invitation tokens
create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_slug text not null,
  invitee_email text not null,
  role_to_assign text not null check (role_to_assign in ('owner', 'manager', 'inventory_admin', 'analyst')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.company_invitations enable row level security;

create policy "company_invitations_no_public_read"
on public.company_invitations
for select
to authenticated
using (false);

create policy "company_invitations_no_public_write"
on public.company_invitations
for all
to authenticated
using (false)
with check (false);

-- Feature catalog (what toggles exist)
create table if not exists public.feature_catalog (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null
);

alter table public.feature_catalog enable row level security;

create policy "feature_catalog_read_authenticated"
on public.feature_catalog
for select
to authenticated
using (true);

-- Default permissions per role
create table if not exists public.role_feature_defaults (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('owner', 'manager', 'inventory_admin', 'analyst')),
  feature_id uuid not null references public.feature_catalog(id) on delete cascade,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (role, feature_id)
);

alter table public.role_feature_defaults enable row level security;

create policy "role_feature_defaults_read_authenticated"
on public.role_feature_defaults
for select
to authenticated
using (true);

-- Per-user overrides (what the UI tab edits)
create table if not exists public.company_user_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.company_users(id) on delete cascade,
  feature_id uuid not null references public.feature_catalog(id) on delete cascade,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (membership_id, feature_id)
);

alter table public.company_user_feature_overrides enable row level security;

create policy "company_user_feature_overrides_no_public_read"
on public.company_user_feature_overrides
for select
to authenticated
using (false);

create policy "company_user_feature_overrides_no_public_write"
on public.company_user_feature_overrides
for all
to authenticated
using (false)
with check (false);

-- Basic updated_at triggers (optional baseline)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists company_users_set_updated_at on public.company_users;
create trigger company_users_set_updated_at
before update on public.company_users
for each row execute function public.set_updated_at();

