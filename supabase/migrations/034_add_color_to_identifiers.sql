-- Migration: 034_add_color_to_identifiers.sql
-- Description: Add color column to inventory_identifiers so each
--   physical unit (IMEI/serial) knows its own colour.
--   The aggregate inventory_colors table remains for quick SKU-level counts.

ALTER TABLE public.inventory_identifiers
  ADD COLUMN IF NOT EXISTS color TEXT;

-- Index for filtering identifiers by color within an inventory item
CREATE INDEX IF NOT EXISTS idx_inv_identifiers_color
  ON public.inventory_identifiers (inventory_id, color)
  WHERE color IS NOT NULL;
