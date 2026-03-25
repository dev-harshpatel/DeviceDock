-- Migration 024: Add inventory_colors table
-- Tracks colour breakdown for each inventory batch.
-- Access is company-scoped: owner / manager / inventory_admin can read and write.

CREATE TABLE IF NOT EXISTS public.inventory_colors (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID        NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  color        TEXT        NOT NULL,
  quantity     INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inventory_id, color)
);

CREATE INDEX IF NOT EXISTS idx_inventory_colors_inventory_id
  ON public.inventory_colors (inventory_id);

ALTER TABLE public.inventory_colors ENABLE ROW LEVEL SECURITY;

-- Company members with write roles can manage colour breakdowns
DROP POLICY IF EXISTS "company_writers_manage_inventory_colors" ON public.inventory_colors;
CREATE POLICY "company_writers_manage_inventory_colors"
  ON public.inventory_colors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory i
      JOIN public.company_users cu ON cu.company_id = i.company_id
      WHERE i.id = inventory_colors.inventory_id
        AND cu.user_id = auth.uid()
        AND cu.role    IN ('owner', 'manager', 'inventory_admin')
        AND cu.status  = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inventory i
      JOIN public.company_users cu ON cu.company_id = i.company_id
      WHERE i.id = inventory_colors.inventory_id
        AND cu.user_id = auth.uid()
        AND cu.role    IN ('owner', 'manager', 'inventory_admin')
        AND cu.status  = 'active'
    )
  );

-- All active company members can read colour breakdowns
DROP POLICY IF EXISTS "company_members_read_inventory_colors" ON public.inventory_colors;
CREATE POLICY "company_members_read_inventory_colors"
  ON public.inventory_colors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory i
      JOIN public.company_users cu ON cu.company_id = i.company_id
      WHERE i.id = inventory_colors.inventory_id
        AND cu.user_id = auth.uid()
        AND cu.status  = 'active'
    )
  );

DROP TRIGGER IF EXISTS inventory_colors_set_updated_at ON public.inventory_colors;
CREATE TRIGGER inventory_colors_set_updated_at
  BEFORE UPDATE ON public.inventory_colors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
