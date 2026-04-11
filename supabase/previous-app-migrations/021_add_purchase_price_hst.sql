-- Add purchase_price and hst columns to inventory table
-- price_per_unit remains as the selling price

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS hst NUMERIC(10,2);
