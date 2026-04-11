-- Migration: 012_add_tax_to_orders.sql
-- Description: Add tax-related columns to orders table

-- Add tax-related columns to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2);

-- Update existing orders: set subtotal = total_price (assuming no tax was applied before)
UPDATE orders
SET subtotal = total_price,
    tax_rate = 0.00,
    tax_amount = 0.00
WHERE subtotal IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN orders.subtotal IS 'Order subtotal before tax';
COMMENT ON COLUMN orders.tax_rate IS 'Tax rate percentage applied (e.g., 13.00 for 13%)';
COMMENT ON COLUMN orders.tax_amount IS 'Tax amount calculated on subtotal';
COMMENT ON COLUMN orders.total_price IS 'Final order total including tax (subtotal + tax_amount)';
