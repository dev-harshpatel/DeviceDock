-- Migration: 017_add_shipping_and_discount_type.sql
-- Description: Add shipping amount and discount type fields to orders table

-- Add shipping amount field to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(10, 2) DEFAULT 0.00;

-- Add discount type field to orders table (percentage or cad)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'cad';

-- Add comments for documentation
COMMENT ON COLUMN orders.shipping_amount IS 'Shipping amount applied to the order (in CAD)';
COMMENT ON COLUMN orders.discount_type IS 'Type of discount applied: percentage or cad';
