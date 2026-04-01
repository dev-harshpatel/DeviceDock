-- Migration: 006_add_cart_items.sql
-- Description: Add cart_items JSONB column to user_profiles table for cart persistence

-- Add cart_items column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS cart_items JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.cart_items IS 'Stores user cart items as JSONB array for cross-device persistence';
