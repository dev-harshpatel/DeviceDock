-- Migration 025: Add order_color_assignments table
-- Records which colours were assigned to each item when an order was fulfilled.
-- Company-scoped: owner / manager can read and write.

CREATE TABLE IF NOT EXISTS public.order_color_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  inventory_id UUID        NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  color        TEXT        NOT NULL,
  quantity     INTEGER     NOT NULL CHECK (quantity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_color_assignments_order_id
  ON public.order_color_assignments (order_id);

ALTER TABLE public.order_color_assignments ENABLE ROW LEVEL SECURITY;

-- Owner / manager can manage colour assignments for their company's orders
DROP POLICY IF EXISTS "company_managers_manage_order_color_assignments" ON public.order_color_assignments;
CREATE POLICY "company_managers_manage_order_color_assignments"
  ON public.order_color_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE o.id = order_color_assignments.order_id
        AND cu.user_id = auth.uid()
        AND cu.role    IN ('owner', 'manager')
        AND cu.status  = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE o.id = order_color_assignments.order_id
        AND cu.user_id = auth.uid()
        AND cu.role    IN ('owner', 'manager')
        AND cu.status  = 'active'
    )
  );
