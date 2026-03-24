-- Add shipping and billing address fields to user_profiles table

-- Shipping Address Fields
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_address_components JSONB,
ADD COLUMN IF NOT EXISTS shipping_city TEXT,
ADD COLUMN IF NOT EXISTS shipping_state TEXT,
ADD COLUMN IF NOT EXISTS shipping_country TEXT,
ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT;

-- Billing Address Fields
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS billing_address_components JSONB,
ADD COLUMN IF NOT EXISTS billing_city TEXT,
ADD COLUMN IF NOT EXISTS billing_state TEXT,
ADD COLUMN IF NOT EXISTS billing_country TEXT,
ADD COLUMN IF NOT EXISTS billing_postal_code TEXT;

-- Flags for "same as business" options
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS shipping_same_as_business BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS billing_same_as_business BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.shipping_address IS 'Full shipping address string';
COMMENT ON COLUMN user_profiles.shipping_address_components IS 'JSON object containing parsed address components from Google Places';
COMMENT ON COLUMN user_profiles.shipping_city IS 'Shipping city name';
COMMENT ON COLUMN user_profiles.shipping_state IS 'Shipping state/province name';
COMMENT ON COLUMN user_profiles.shipping_country IS 'Shipping country (Canada or USA)';
COMMENT ON COLUMN user_profiles.shipping_postal_code IS 'Shipping postal/zip code';

COMMENT ON COLUMN user_profiles.billing_address IS 'Full billing address string';
COMMENT ON COLUMN user_profiles.billing_address_components IS 'JSON object containing parsed address components from Google Places';
COMMENT ON COLUMN user_profiles.billing_city IS 'Billing city name';
COMMENT ON COLUMN user_profiles.billing_state IS 'Billing state/province name';
COMMENT ON COLUMN user_profiles.billing_country IS 'Billing country (Canada or USA)';
COMMENT ON COLUMN user_profiles.billing_postal_code IS 'Billing postal/zip code';

COMMENT ON COLUMN user_profiles.shipping_same_as_business IS 'If true, shipping address is same as business address';
COMMENT ON COLUMN user_profiles.billing_same_as_business IS 'If true, billing address is same as business address';
