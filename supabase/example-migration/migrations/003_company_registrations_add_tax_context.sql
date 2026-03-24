alter table public.company_registrations
  add column if not exists timezone text not null default 'UTC',
  add column if not exists currency text not null default 'USD';

