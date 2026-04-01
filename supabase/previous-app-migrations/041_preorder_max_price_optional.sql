-- Allow wishes to be pre-orders (no user-specified max price).
-- The admin sets the price when they fulfil the request.

ALTER TABLE public.wishes
  ALTER COLUMN max_price_per_unit DROP NOT NULL;

ALTER TABLE public.wishes
  DROP CONSTRAINT IF EXISTS wishes_max_price_per_unit_check;

ALTER TABLE public.wishes
  ADD CONSTRAINT wishes_max_price_per_unit_check
    CHECK (max_price_per_unit IS NULL OR max_price_per_unit >= 0);
