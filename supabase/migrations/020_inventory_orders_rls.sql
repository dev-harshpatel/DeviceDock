-- Migration: 020_inventory_orders_rls.sql
-- Enables RLS on inventory and orders and adds company-scoped policies.
-- Without this, Supabase may silently restrict access for the authenticated role.
-- Must run AFTER 006 (inventory + orders created) and 001 (company_users defined).

-- ── INVENTORY ─────────────────────────────────────────────────────────────────

alter table public.inventory enable row level security;

-- Drop any legacy policies from the old single-tenant migration (002_rls_policies.sql)
drop policy if exists "Public can read inventory"         on public.inventory;
drop policy if exists "Authenticated can read inventory"  on public.inventory;
drop policy if exists "Admins can insert inventory"       on public.inventory;
drop policy if exists "Admins can update inventory"       on public.inventory;
drop policy if exists "Admins can delete inventory"       on public.inventory;

-- Drop new policy names (idempotent re-run safety)
drop policy if exists "company_members_select_inventory" on public.inventory;
create policy "company_members_select_inventory"
on public.inventory
for select
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = inventory.company_id
      and cu.status     = 'active'
  )
);

-- Only owner / manager / inventory_admin can insert
drop policy if exists "company_writers_insert_inventory" on public.inventory;
create policy "company_writers_insert_inventory"
on public.inventory
for insert
to authenticated
with check (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = inventory.company_id
      and cu.role       in ('owner', 'manager', 'inventory_admin')
      and cu.status     = 'active'
  )
);

-- Only owner / manager / inventory_admin can update
drop policy if exists "company_writers_update_inventory" on public.inventory;
create policy "company_writers_update_inventory"
on public.inventory
for update
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = inventory.company_id
      and cu.role       in ('owner', 'manager', 'inventory_admin')
      and cu.status     = 'active'
  )
)
with check (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = inventory.company_id
      and cu.role       in ('owner', 'manager', 'inventory_admin')
      and cu.status     = 'active'
  )
);

-- Only owner / manager can delete inventory rows
drop policy if exists "company_owners_delete_inventory" on public.inventory;
create policy "company_owners_delete_inventory"
on public.inventory
for delete
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = inventory.company_id
      and cu.role       in ('owner', 'manager')
      and cu.status     = 'active'
  )
);

-- ── ORDERS ────────────────────────────────────────────────────────────────────

alter table public.orders enable row level security;

-- Drop any legacy policies from the old single-tenant migration
drop policy if exists "Users can view own orders"    on public.orders;
drop policy if exists "Users can create orders"      on public.orders;
drop policy if exists "Admins can view all orders"   on public.orders;
drop policy if exists "Admins can update orders"     on public.orders;

-- Drop new policy names (idempotent re-run safety)
drop policy if exists "company_members_select_orders" on public.orders;
create policy "company_members_select_orders"
on public.orders
for select
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = orders.company_id
      and cu.status     = 'active'
  )
);

-- Any active company member can create orders
drop policy if exists "company_members_insert_orders" on public.orders;
create policy "company_members_insert_orders"
on public.orders
for insert
to authenticated
with check (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = orders.company_id
      and cu.status     = 'active'
  )
);

-- Owner / manager can update any order; others can only update their own
drop policy if exists "company_members_update_orders" on public.orders;
create policy "company_members_update_orders"
on public.orders
for update
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = orders.company_id
      and cu.status     = 'active'
  )
)
with check (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = orders.company_id
      and cu.status     = 'active'
  )
);

-- Only owner / manager can delete orders
drop policy if exists "company_owners_delete_orders" on public.orders;
create policy "company_owners_delete_orders"
on public.orders
for delete
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.user_id    = auth.uid()
      and cu.company_id = orders.company_id
      and cu.role       in ('owner', 'manager')
      and cu.status     = 'active'
  )
);
