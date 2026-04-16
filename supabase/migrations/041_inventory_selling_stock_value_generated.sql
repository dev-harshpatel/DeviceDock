-- Generated column for sorting inventory by on-hand retail value (qty × selling_price).
-- Used by admin inventory list ordering; safe additive change.

DO $$
BEGIN
  IF to_regclass('public.inventory') IS NOT NULL THEN
    ALTER TABLE public.inventory
      ADD COLUMN IF NOT EXISTS selling_stock_value numeric
      GENERATED ALWAYS AS (
        (COALESCE(quantity, 0))::numeric * COALESCE(selling_price, 0)::numeric
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_company_selling_stock_value
  ON public.inventory (company_id, selling_stock_value DESC);
