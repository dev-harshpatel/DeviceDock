-- Migration: 031_inventory_identifiers.sql
-- Description: Move per-unit IMEI/Serial tracking to a dedicated table.
--   One inventory row = one product configuration (brand+device+grade+storage).
--   One inventory_identifiers row = one physical unit (IMEI or serial number).
--   Run AFTER 030_imei_inventory_foundation.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create inventory_identifiers (per-unit tracking)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_identifiers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id    uuid        NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  imei            text,
  serial_number   text,
  status          text        NOT NULL DEFAULT 'in_stock'
                              CHECK (status IN ('in_stock', 'reserved', 'sold', 'returned', 'damaged')),
  sold_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_identifier_unit_check
    CHECK (imei IS NOT NULL OR serial_number IS NOT NULL)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Unique active IMEI per company (prevent duplicate in-stock/reserved units)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_identifiers_active_imei
  ON public.inventory_identifiers (company_id, imei)
  WHERE imei IS NOT NULL AND status IN ('in_stock', 'reserved');

-- Unique active serial per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_identifiers_active_serial
  ON public.inventory_identifiers (company_id, serial_number)
  WHERE serial_number IS NOT NULL AND status IN ('in_stock', 'reserved');

CREATE INDEX IF NOT EXISTS idx_inv_identifiers_inventory_id
  ON public.inventory_identifiers (inventory_id);

CREATE INDEX IF NOT EXISTS idx_inv_identifiers_status
  ON public.inventory_identifiers (status);

CREATE INDEX IF NOT EXISTS idx_inv_identifiers_company_id
  ON public.inventory_identifiers (company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Migrate existing IMEI/serial data from inventory rows → identifiers table
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.inventory_identifiers (inventory_id, company_id, imei, serial_number, status)
SELECT
  id,
  company_id,
  imei,
  serial_number,
  COALESCE(status, 'in_stock')
FROM public.inventory
WHERE imei IS NOT NULL OR serial_number IS NOT NULL
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop the old constraint that forced every inventory row to have an IMEI.
--    Inventory rows now represent configurations, not individual units.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_identifier_check;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS inventory_identifiers_set_updated_at ON public.inventory_identifiers;
CREATE TRIGGER inventory_identifiers_set_updated_at
  BEFORE UPDATE ON public.inventory_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
