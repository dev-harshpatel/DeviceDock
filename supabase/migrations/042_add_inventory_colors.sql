-- Migration 042: Add inventory_colors table
-- Tracks colour breakdown for each inventory batch (admin-only, never exposed to users)

CREATE TABLE IF NOT EXISTS public.inventory_colors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID       NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  color       TEXT        NOT NULL,
  quantity    INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(inventory_id, color)
);

-- Enable RLS — no user access at all
ALTER TABLE public.inventory_colors ENABLE ROW LEVEL SECURITY;

-- Admins have full access; regular users have zero access (no policy created for them)
CREATE POLICY "Admins can manage inventory colors"
  ON public.inventory_colors
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
