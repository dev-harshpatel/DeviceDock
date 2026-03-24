-- Add manual sale fields to orders table
-- Allows admins to record sales that happen outside the platform
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_manual_sale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_customer_name TEXT,
  ADD COLUMN IF NOT EXISTS manual_customer_email TEXT,
  ADD COLUMN IF NOT EXISTS manual_customer_phone TEXT;
