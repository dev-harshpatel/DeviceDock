-- Wishes: request-based wishlist where users specify desired devices
-- and admins can make offers that can be reserved or ordered.

CREATE TABLE IF NOT EXISTS public.wishes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- User's desired device
  model                   text NOT NULL,
  grade                   text NOT NULL,
  storage                 text NOT NULL,
  qty_wanted              int  NOT NULL CHECK (qty_wanted >= 1 AND qty_wanted <= 999),
  max_price_per_unit      numeric(10, 2) NOT NULL CHECK (max_price_per_unit > 0),
  -- Lifecycle status
  status                  text NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending',
                            'offered',
                            'reserved',
                            'ordered',
                            'fulfilled',
                            'rejected',
                            'cancelled'
                          )),
  -- Admin offer details
  offer_price_per_unit    numeric(10, 2),
  offer_qty               int CHECK (offer_qty IS NULL OR offer_qty >= 1),
  offer_inventory_item_id uuid REFERENCES public.inventory (id) ON DELETE SET NULL,
  offer_created_at        timestamptz,
  admin_notes             text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;

-- Users can see and manage only their own wishes
CREATE POLICY "Users can select own wishes"
  ON public.wishes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishes"
  ON public.wishes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update limited fields on their own wishes.
-- NOTE: We rely on application logic to restrict which fields are updated.
CREATE POLICY "Users can update own wishes"
  ON public.wishes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read and update all wishes
CREATE POLICY "Admins can select all wishes"
  ON public.wishes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all wishes"
  ON public.wishes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = 'admin'
    )
  );

-- Basic trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_wishes_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_wishes_updated_at ON public.wishes;

CREATE TRIGGER set_wishes_updated_at
BEFORE UPDATE ON public.wishes
FOR EACH ROW
EXECUTE FUNCTION public.set_wishes_updated_at();

-- Enable realtime so users see offers immediately
ALTER PUBLICATION supabase_realtime ADD TABLE public.wishes;

