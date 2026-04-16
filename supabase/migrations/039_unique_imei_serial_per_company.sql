-- Migration: 039_unique_imei_serial_per_company.sql
-- Description: Enforce that an IMEI or serial number can only exist once per company
--   across ALL statuses (in_stock, reserved, sold, returned, damaged).
--   Previously the partial indexes only covered in_stock/reserved, so a sold
--   IMEI could be re-inserted as a new in_stock record.
--
-- Safe to run on existing data: if duplicates exist (sold + new in_stock) the
-- INSERT below will surface them so they can be resolved before the index lands.

-- Drop the old partial indexes (in_stock/reserved only) and replace with full ones.

DROP INDEX IF EXISTS idx_inv_identifiers_active_imei;
DROP INDEX IF EXISTS idx_inv_identifiers_active_serial;

-- Full unique constraint: one IMEI per company, regardless of status.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_identifiers_imei_per_company
  ON public.inventory_identifiers (company_id, imei)
  WHERE imei IS NOT NULL;

-- Full unique constraint: one serial number per company, regardless of status.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_identifiers_serial_per_company
  ON public.inventory_identifiers (company_id, serial_number)
  WHERE serial_number IS NOT NULL;
