-- Migration: 009_add_business_state_city.sql
-- Description: Add business_state, business_city, and business_country columns to user_profiles table

-- Add business location columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS business_state TEXT,
ADD COLUMN IF NOT EXISTS business_city TEXT,
ADD COLUMN IF NOT EXISTS business_country TEXT DEFAULT 'Canada';

-- Create index for faster lookups by state
CREATE INDEX IF NOT EXISTS idx_user_profiles_business_state ON user_profiles(business_state);

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.business_state IS 'State or province where the business is located';
COMMENT ON COLUMN user_profiles.business_city IS 'City where the business is located';
COMMENT ON COLUMN user_profiles.business_country IS 'Country where the business is located (Canada or USA)';
