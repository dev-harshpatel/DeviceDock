-- Add high-impact indexes for list filters/sorts and search.

create extension if not exists pg_trgm;

-- Orders
create index if not exists idx_orders_company_created_at
  on public.orders (company_id, created_at desc);

create index if not exists idx_orders_company_status_created_at
  on public.orders (company_id, status, created_at desc);

create index if not exists idx_orders_company_user_created_at
  on public.orders (company_id, user_id, created_at desc);

-- Inventory
create index if not exists idx_inventory_company_active_created_at
  on public.inventory (company_id, created_at desc, id)
  where is_active = true;

create index if not exists idx_inventory_company_brand_active
  on public.inventory (company_id, brand)
  where is_active = true;

create index if not exists idx_inventory_company_grade_active
  on public.inventory (company_id, grade)
  where is_active = true;

create index if not exists idx_inventory_company_storage_active
  on public.inventory (company_id, storage)
  where is_active = true;

create index if not exists idx_inventory_company_selling_price_active
  on public.inventory (company_id, selling_price)
  where is_active = true;

create index if not exists idx_inventory_company_quantity_active
  on public.inventory (company_id, quantity)
  where is_active = true;

create index if not exists idx_inventory_device_name_trgm_active
  on public.inventory using gin (lower(device_name) gin_trgm_ops)
  where is_active = true;

-- Company users / invitations
create index if not exists idx_company_users_company_status_created_at
  on public.company_users (company_id, status, created_at asc);

create index if not exists idx_company_invitations_pending_company_created_at
  on public.company_invitations (company_id, created_at desc)
  where consumed_at is null;

create index if not exists idx_company_invitations_pending_company_expires_at
  on public.company_invitations (company_id, expires_at)
  where consumed_at is null;


