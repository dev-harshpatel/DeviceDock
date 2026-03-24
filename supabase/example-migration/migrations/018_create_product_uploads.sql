-- Migration: 018_create_product_uploads.sql
-- Tracks per-company product uploads submitted via Excel file on the Upload Products page.
-- Must be run AFTER 001 (companies, company_users, set_updated_at) and 006 (inventory).

create table if not exists public.product_uploads (
  id                 uuid        primary key default gen_random_uuid(),
  company_id         uuid        not null references public.companies(id) on delete cascade,
  uploaded_by        uuid        not null references auth.users(id) on delete cascade,
  file_name          text        not null,
  total_products     integer     not null default 0,
  successful_inserts integer     not null default 0,
  failed_inserts     integer     not null default 0,
  upload_status      text        not null default 'pending'
    check (upload_status in ('pending', 'completed', 'failed')),
  error_message      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_product_uploads_company_id  on public.product_uploads(company_id);
create index if not exists idx_product_uploads_uploaded_by on public.product_uploads(uploaded_by);
create index if not exists idx_product_uploads_created_at  on public.product_uploads(created_at desc);
create index if not exists idx_product_uploads_status      on public.product_uploads(upload_status);

alter table public.product_uploads enable row level security;

-- owners, managers, and inventory_admins can insert upload records for their company
create policy "company_members_insert_product_uploads"
on public.product_uploads
for insert
to authenticated
with check (
  exists (
    select 1 from public.company_users cu
    where cu.user_id   = auth.uid()
      and cu.company_id = product_uploads.company_id
      and cu.role       in ('owner', 'manager', 'inventory_admin')
      and cu.status     = 'active'
  )
);

-- owners, managers, and inventory_admins can read their company's upload history
create policy "company_members_select_product_uploads"
on public.product_uploads
for select
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.user_id   = auth.uid()
      and cu.company_id = product_uploads.company_id
      and cu.role       in ('owner', 'manager', 'inventory_admin')
      and cu.status     = 'active'
  )
);

-- owners, managers, and inventory_admins can update their company's upload records
create policy "company_members_update_product_uploads"
on public.product_uploads
for update
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.user_id   = auth.uid()
      and cu.company_id = product_uploads.company_id
      and cu.role       in ('owner', 'manager', 'inventory_admin')
      and cu.status     = 'active'
  )
)
with check (
  exists (
    select 1 from public.company_users cu
    where cu.user_id   = auth.uid()
      and cu.company_id = product_uploads.company_id
      and cu.role       in ('owner', 'manager', 'inventory_admin')
      and cu.status     = 'active'
  )
);

drop trigger if exists product_uploads_set_updated_at on public.product_uploads;
create trigger product_uploads_set_updated_at
before update on public.product_uploads
for each row execute function public.set_updated_at();

comment on table public.product_uploads is
  'Tracks per-company product uploads (Excel imports) with counts and status';
