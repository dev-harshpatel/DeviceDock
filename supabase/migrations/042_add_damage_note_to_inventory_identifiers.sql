-- Adds an optional free-text damage note to individual inventory units.
-- Used when a D-grade phone is added so staff can record what part is damaged.

DO $$
BEGIN
  IF to_regclass('public.inventory_identifiers') IS NOT NULL THEN
    ALTER TABLE public.inventory_identifiers
      ADD COLUMN IF NOT EXISTS damage_note TEXT DEFAULT NULL;
  END IF;
END $$;
