-- Migration: 014_add_discount_to_orders.sql
-- Description: Add discount field to orders table

-- Add discount field to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0.00;

-- Add comment for documentation
COMMENT ON COLUMN orders.discount_amount IS 'Discount amount applied to the order (in CAD)';
