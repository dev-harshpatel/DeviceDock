-- Migration: 021_fix_all_legacy_rls.sql
-- Drops every old single-tenant policy (from legacy supabase/migrations/ set)
-- and replaces them with correct multi-tenant, company-scoped policies.
--
-- Run this ONCE after 020_inventory_orders_rls.sql.
-- All DROP … IF EXISTS are safe to run multiple times.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DROP the legacy is_admin() helper (was used by old policies only)
--    We replace every caller below; leaving the function in place causes
--    false-returning SELECTs whenever user_profiles is empty / absent.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists is_admin(uuid) cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TAX_RATES
--    Global reference data — every authenticated company member must be able
--    to read it (used when calculating order tax totals).
--    Writes are handled exclusively by service-role migrations.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tax_rates enable row level security;

-- Drop old is_admin() policies
drop policy if exists "Admins can insert tax rates" on public.tax_rates;
drop policy if exists "Admins can read tax rates"   on public.tax_rates;
drop policy if exists "Admins can update tax rates" on public.tax_rates;
drop policy if exists "Admins can delete tax rates" on public.tax_rates;

-- Any active company member can read tax rates
drop policy if exists "authenticated_read_tax_rates" on public.tax_rates;
create policy "authenticated_read_tax_rates"
on public.tax_rates
for select
to authenticated
using (true);

-- Only platform super admins can write tax rate rows
drop policy if exists "super_admin_write_tax_rates" on public.tax_rates;
create policy "super_admin_write_tax_rates"
on public.tax_rates
for all
to authenticated
using (
  exists (
    select 1 from public.platform_super_admins psa
    where psa.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.platform_super_admins psa
    where psa.user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PLATFORM_AUDIT_LOGS
--    Platform-level traceability — only super admins can read or write.
--    Migration 017 created the table without any RLS policies.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.platform_audit_logs enable row level security;

drop policy if exists "super_admin_select_audit_logs" on public.platform_audit_logs;
create policy "super_admin_select_audit_logs"
on public.platform_audit_logs
for select
to authenticated
using (
  exists (
    select 1 from public.platform_super_admins psa
    where psa.user_id = auth.uid()
  )
);

drop policy if exists "super_admin_insert_audit_logs" on public.platform_audit_logs;
create policy "super_admin_insert_audit_logs"
on public.platform_audit_logs
for insert
to authenticated
with check (
  exists (
    select 1 from public.platform_super_admins psa
    where psa.user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. USER_PROFILES (legacy table — may exist if old migrations were applied)
--    In the new tenancy model this table is unused, but if it exists its
--    old policies caused the is_admin() recursion that blocked everything.
--    We leave the table intact (harmless) but remove the blocking policies.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.user_profiles') is not null then
    -- Drop all old policies so nothing references the now-dropped is_admin()
    drop policy if exists "Users can read own profile"   on public.user_profiles;
    drop policy if exists "Admins can read all profiles" on public.user_profiles;
    drop policy if exists "Users can insert own profile" on public.user_profiles;
    drop policy if exists "Users can update own profile" on public.user_profiles;
    drop policy if exists "Admins can update any profile" on public.user_profiles;

    -- Re-add a simple self-read policy so auth callbacks don't error
    execute $p$
      create policy if not exists "user_profiles_self_access"
      on public.user_profiles
      for all
      to authenticated
      using  (user_id = auth.uid())
      with check (user_id = auth.uid())
    $p$;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INVENTORY_COLORS (legacy table — may exist if old migration 042 ran)
--    The old policy used user_profiles.role = 'admin'.
--    Replace with company_users role check.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.inventory_colors') is not null then
    drop policy if exists "Admins can manage inventory colors" on public.inventory_colors;

    execute $p$
      create policy if not exists "company_writers_manage_inventory_colors"
      on public.inventory_colors
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.inventory i
          join public.company_users cu
            on cu.company_id = i.company_id
           and cu.user_id    = auth.uid()
           and cu.role       in ('owner', 'manager', 'inventory_admin')
           and cu.status     = 'active'
          where i.id = inventory_colors.inventory_id
        )
      )
      with check (
        exists (
          select 1
          from public.inventory i
          join public.company_users cu
            on cu.company_id = i.company_id
           and cu.user_id    = auth.uid()
           and cu.role       in ('owner', 'manager', 'inventory_admin')
           and cu.status     = 'active'
          where i.id = inventory_colors.inventory_id
        )
      )
    $p$;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ORDER_COLOR_ASSIGNMENTS (legacy table — may exist if old migration 043 ran)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.order_color_assignments') is not null then
    drop policy if exists "Admins can manage order color assignments" on public.order_color_assignments;

    execute $p$
      create policy if not exists "company_writers_manage_order_color_assignments"
      on public.order_color_assignments
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.orders o
          join public.company_users cu
            on cu.company_id = o.company_id
           and cu.user_id    = auth.uid()
           and cu.role       in ('owner', 'manager', 'inventory_admin')
           and cu.status     = 'active'
          where o.id = order_color_assignments.order_id
        )
      )
      with check (
        exists (
          select 1
          from public.orders o
          join public.company_users cu
            on cu.company_id = o.company_id
           and cu.user_id    = auth.uid()
           and cu.role       in ('owner', 'manager', 'inventory_admin')
           and cu.status     = 'active'
          where o.id = order_color_assignments.order_id
        )
      )
    $p$;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. STOCK_REQUESTS (legacy table — may exist if old migration 030 ran)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.stock_requests') is not null then
    drop policy if exists "Users can read own stock requests"   on public.stock_requests;
    drop policy if exists "Users can insert own stock requests" on public.stock_requests;
    drop policy if exists "Users can update own stock requests" on public.stock_requests;
    drop policy if exists "Admins can read all stock requests"  on public.stock_requests;
    drop policy if exists "Admins can update all stock requests" on public.stock_requests;

    -- Any authenticated user can manage their own requests
    execute $p$
      create policy if not exists "users_own_stock_requests"
      on public.stock_requests
      for all
      to authenticated
      using  (user_id = auth.uid())
      with check (user_id = auth.uid())
    $p$;

    -- Owners / managers can read all stock requests for their company
    execute $p$
      create policy if not exists "company_managers_read_stock_requests"
      on public.stock_requests
      for select
      to authenticated
      using (
        exists (
          select 1 from public.company_users cu
          where cu.user_id = auth.uid()
            and cu.role    in ('owner', 'manager')
            and cu.status  = 'active'
        )
      )
    $p$;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. WISHES (legacy table — may exist if old migration 039 ran)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.wishes') is not null then
    drop policy if exists "Users can select own wishes"       on public.wishes;
    drop policy if exists "Users can insert own wishes"       on public.wishes;
    drop policy if exists "Users can update own wishes"       on public.wishes;
    drop policy if exists "Admins can select all wishes"      on public.wishes;
    drop policy if exists "Admins can update all wishes"      on public.wishes;

    execute $p$
      create policy if not exists "users_own_wishes"
      on public.wishes
      for all
      to authenticated
      using  (user_id = auth.uid())
      with check (user_id = auth.uid())
    $p$;

    execute $p$
      create policy if not exists "company_managers_read_wishes"
      on public.wishes
      for select
      to authenticated
      using (
        exists (
          select 1 from public.company_users cu
          where cu.user_id = auth.uid()
            and cu.role    in ('owner', 'manager')
            and cu.status  = 'active'
        )
      )
    $p$;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. COMPANY_SETTINGS (legacy table — may exist if old migration 023 ran)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.company_settings') is not null then
    drop policy if exists "Anyone can read company settings"       on public.company_settings;
    drop policy if exists "Only admins can update company settings" on public.company_settings;

    execute $p$
      create policy if not exists "company_members_read_company_settings"
      on public.company_settings
      for select
      to authenticated
      using (
        exists (
          select 1 from public.company_users cu
          where cu.user_id    = auth.uid()
            and cu.company_id = company_settings.company_id
            and cu.status     = 'active'
        )
      )
    $p$;

    execute $p$
      create policy if not exists "company_owners_write_company_settings"
      on public.company_settings
      for all
      to authenticated
      using (
        exists (
          select 1 from public.company_users cu
          where cu.user_id    = auth.uid()
            and cu.company_id = company_settings.company_id
            and cu.role       in ('owner', 'manager')
            and cu.status     = 'active'
        )
      )
      with check (
        exists (
          select 1 from public.company_users cu
          where cu.user_id    = auth.uid()
            and cu.company_id = company_settings.company_id
            and cu.role       in ('owner', 'manager')
            and cu.status     = 'active'
        )
      )
    $p$;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. PRODUCT_UPLOADS
--     Migration 018 already created this with correct RLS.
--     Drop old legacy policy names just in case they snuck in.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Admins can insert product uploads" on public.product_uploads;
drop policy if exists "Admins can read product uploads"   on public.product_uploads;
drop policy if exists "Admins can update product uploads" on public.product_uploads;
drop policy if exists "Admins can delete product uploads" on public.product_uploads;
