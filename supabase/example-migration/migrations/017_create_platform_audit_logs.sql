-- Super admin action audit log for platform-level traceability.

create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_email text,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  company_id uuid references public.companies(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_audit_logs_created_at
  on public.platform_audit_logs (created_at desc);

create index if not exists idx_platform_audit_logs_actor_created
  on public.platform_audit_logs (actor_user_id, created_at desc);

create index if not exists idx_platform_audit_logs_resource
  on public.platform_audit_logs (resource_type, resource_id, created_at desc);

create index if not exists idx_platform_audit_logs_company_created
  on public.platform_audit_logs (company_id, created_at desc);
