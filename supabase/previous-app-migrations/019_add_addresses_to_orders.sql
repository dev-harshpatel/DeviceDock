-- Add shipping and billing address fields to orders table (address only, no city/state/country/postal_code)

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN orders.shipping_address IS 'Full shipping address for the order';
COMMENT ON COLUMN orders.billing_address IS 'Full billing address for the order';
