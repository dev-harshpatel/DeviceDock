-- Adds per-unit purchase cost to individual inventory units.
-- When a device is added with an IMEI/serial the exact price paid for that
-- specific unit is stored here so the IMEI-edit screen can show and preserve
-- the real cost rather than the group-average from the parent inventory row.

DO $$
BEGIN
  IF to_regclass('public.inventory_identifiers') IS NOT NULL THEN
    ALTER TABLE public.inventory_identifiers
      ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,4) DEFAULT NULL;
  END IF;
END $$;
