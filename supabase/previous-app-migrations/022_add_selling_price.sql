-- Add selling_price column to inventory
-- selling_price = what users see and pay (admin decides)
-- price_per_unit = calculated cost per unit: (purchase_price / quantity) * (1 + hst/100)
-- hst = percentage (e.g. 13 for 13%)

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10,2);

-- Migrate: copy existing price_per_unit to selling_price (it was the selling price before)
UPDATE inventory SET selling_price = price_per_unit WHERE selling_price IS NULL;
