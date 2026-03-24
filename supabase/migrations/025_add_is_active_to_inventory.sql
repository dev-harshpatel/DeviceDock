-- Add is_active column to inventory table
-- Allows admin to temporarily deactivate products from the user-facing store

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- All existing products should remain active
UPDATE inventory SET is_active = true WHERE is_active IS NULL;
