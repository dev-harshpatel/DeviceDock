-- Migration 049: Create user_profiles table
-- This table was referenced throughout the codebase but never created in the
-- current SaaS tenancy schema. Migration 001 (init_tenancy_auth) did not include
-- it; this migration adds it idempotently.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       UUID          NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role                          TEXT          NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  approval_status               TEXT          NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_status_updated_at    TIMESTAMPTZ,
  first_name                    TEXT,
  last_name                     TEXT,
  phone                         TEXT,
  business_name                 TEXT,
  business_address              TEXT,
  business_address_components   JSONB,
  business_state                TEXT,
  business_city                 TEXT,
  business_country              TEXT,
  business_years                INTEGER,
  business_website              TEXT,
  business_email                TEXT,
  cart_items                    JSONB,
  wishlist_items                JSONB,
  shipping_address              TEXT,
  shipping_address_components   JSONB,
  shipping_city                 TEXT,
  shipping_state                TEXT,
  shipping_country              TEXT,
  shipping_postal_code          TEXT,
  billing_address               TEXT,
  billing_address_components    JSONB,
  billing_city                  TEXT,
  billing_state                 TEXT,
  billing_country               TEXT,
  billing_postal_code           TEXT,
  shipping_same_as_business     BOOLEAN       NOT NULL DEFAULT FALSE,
  billing_same_as_business      BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at                    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
CREATE POLICY "users_manage_own_profile"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
