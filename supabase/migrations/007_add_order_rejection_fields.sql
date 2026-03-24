-- Migration: 007_add_order_rejection_fields.sql
-- Description: Add rejection_reason and rejection_comment fields to orders table

-- Add rejection_reason column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add rejection_comment column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS rejection_comment TEXT;

-- Add comments for documentation
COMMENT ON COLUMN orders.rejection_reason IS 'Common rejection reason selected from dropdown (e.g., "Product out of stock")';
COMMENT ON COLUMN orders.rejection_comment IS 'Optional additional comment provided by admin when rejecting an order';
