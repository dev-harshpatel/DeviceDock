-- Migration: 047_add_performance_indexes.sql
-- Description: Add high-impact indexes for hot filters/sorts used by app queries.

-- Trigram support for fast ILIKE on device names (safe if already enabled).
create extension if not exists pg_trgm;

-- Orders: tenant-scoped list, status filtering, user history.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'company_id'
  ) then
    create index if not exists idx_orders_company_created_at
      on public.orders (company_id, created_at desc);

    create index if not exists idx_orders_company_status_created_at
      on public.orders (company_id, status, created_at desc);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'company_id'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'user_id'
  ) then
    create index if not exists idx_orders_company_user_created_at
      on public.orders (company_id, user_id, created_at desc);
  end if;
end $$;

-- Inventory: tenant-scoped filters and active list views.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory'
      and column_name = 'company_id'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory'
      and column_name = 'is_active'
  ) then
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
  end if;
end $$;

-- Deleted orders archive: tenant-scoped paging by deleted timestamp.
do $$
begin
  if to_regclass('public.deleted_orders') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'deleted_orders'
         and column_name = 'company_id'
     ) then
    create index if not exists idx_deleted_orders_company_deleted_at
      on public.deleted_orders (company_id, deleted_at desc);
  end if;
end $$;

-- Company members: list and membership checks.
do $$
begin
  if to_regclass('public.company_users') is not null then
    create index if not exists idx_company_users_company_status_created_at
      on public.company_users (company_id, status, created_at asc);
  end if;
end $$;

-- Company invitations: pending invitations by company.
do $$
begin
  if to_regclass('public.company_invitations') is not null then
    create index if not exists idx_company_invitations_pending_company_created_at
      on public.company_invitations (company_id, created_at desc)
      where consumed_at is null;

    create index if not exists idx_company_invitations_pending_company_expires_at
      on public.company_invitations (company_id, expires_at)
      where consumed_at is null;
  end if;
end $$;

-- Wishes: user/admin list views ordered by created_at.
do $$
begin
  if to_regclass('public.wishes') is not null then
    create index if not exists idx_wishes_user_created_at
      on public.wishes (user_id, created_at desc);

    create index if not exists idx_wishes_status_created_at
      on public.wishes (status, created_at desc);
  end if;
end $$;

