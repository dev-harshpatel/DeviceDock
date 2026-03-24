-- Backfill selling_price for existing inventory rows
-- Ensures selling_price column exists, then backfills from price_per_unit, then recalculates price_per_unit as cost.
-- Run in Supabase SQL Editor.

-- Step 0: Ensure selling_price column exists (safe if migration 022 was already run)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10,2);

-- Step 1: Set selling_price = price_per_unit where selling_price is NULL
-- (price_per_unit was previously used as the selling price)
UPDATE inventory
SET selling_price = price_per_unit
WHERE selling_price IS NULL;

-- Step 2: Recalculate price_per_unit as cost per unit for rows that have purchase_price and hst
-- Formula: (purchase_price / quantity) * (1 + hst / 100)
-- Only update where purchase_price is not null and quantity > 0
UPDATE inventory
SET price_per_unit = ROUND(
  (purchase_price / NULLIF(quantity, 0)) * (1 + COALESCE(hst, 0) / 100.0),
  2
)
WHERE purchase_price IS NOT NULL
  AND quantity > 0;
