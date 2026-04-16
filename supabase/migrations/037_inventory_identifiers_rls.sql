-- Migration: 037_inventory_identifiers_rls.sql
-- Description: Add RLS policies for inventory_identifiers table.
--   Migration 031 created the table but omitted RLS, causing 403 on every insert.
--   Policies mirror the pattern used for inventory (020_inventory_orders_rls.sql).

ALTER TABLE public.inventory_identifiers ENABLE ROW LEVEL SECURITY;

-- ── SELECT ────────────────────────────────────────────────────────────────────
-- Any active company member can read their company's unit identifiers.

DROP POLICY IF EXISTS "company_members_select_inventory_identifiers" ON public.inventory_identifiers;
CREATE POLICY "company_members_select_inventory_identifiers"
ON public.inventory_identifiers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id    = auth.uid()
      AND cu.company_id = inventory_identifiers.company_id
      AND cu.status     = 'active'
  )
);

-- ── INSERT ────────────────────────────────────────────────────────────────────
-- Only owner / manager / inventory_admin can add per-unit identifier rows.

DROP POLICY IF EXISTS "company_writers_insert_inventory_identifiers" ON public.inventory_identifiers;
CREATE POLICY "company_writers_insert_inventory_identifiers"
ON public.inventory_identifiers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id    = auth.uid()
      AND cu.company_id = inventory_identifiers.company_id
      AND cu.role       IN ('owner', 'manager', 'inventory_admin')
      AND cu.status     = 'active'
  )
);

-- ── UPDATE ────────────────────────────────────────────────────────────────────
-- Any active company member can update identifier status.
-- Needed so that regular members can mark identifiers sold/reverted when placing orders.

DROP POLICY IF EXISTS "company_members_update_inventory_identifiers" ON public.inventory_identifiers;
CREATE POLICY "company_members_update_inventory_identifiers"
ON public.inventory_identifiers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id    = auth.uid()
      AND cu.company_id = inventory_identifiers.company_id
      AND cu.status     = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id    = auth.uid()
      AND cu.company_id = inventory_identifiers.company_id
      AND cu.status     = 'active'
  )
);

-- ── DELETE ────────────────────────────────────────────────────────────────────
-- Only owner / manager can delete identifier rows directly.
-- Cascade deletes from inventory (ON DELETE CASCADE) bypass RLS and are always safe.

DROP POLICY IF EXISTS "company_owners_delete_inventory_identifiers" ON public.inventory_identifiers;
CREATE POLICY "company_owners_delete_inventory_identifiers"
ON public.inventory_identifiers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id    = auth.uid()
      AND cu.company_id = inventory_identifiers.company_id
      AND cu.role       IN ('owner', 'manager')
      AND cu.status     = 'active'
  )
);
