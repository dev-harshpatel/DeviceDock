-- Order colour assignments: records which colours were assigned to each item when an order was fulfilled.
-- Admin-only — users must never be able to read this data.

CREATE TABLE IF NOT EXISTS public.order_color_assignments (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID         NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  inventory_id UUID         NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  color        TEXT         NOT NULL,
  quantity     INTEGER      NOT NULL CHECK (quantity > 0),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for fast look-ups by order
CREATE INDEX IF NOT EXISTS order_color_assignments_order_id_idx
  ON public.order_color_assignments (order_id);

ALTER TABLE public.order_color_assignments ENABLE ROW LEVEL SECURITY;

-- Admins only — no user access whatsoever
CREATE POLICY "Admins can manage order color assignments"
  ON public.order_color_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
