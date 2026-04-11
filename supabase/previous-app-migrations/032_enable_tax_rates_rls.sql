-- Enable RLS on tax_rates: only authenticated users with admin role can access
-- Run via: npx supabase db push (or Supabase SQL Editor)

-- 1. Enable Row Level Security
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist (idempotent for re-runs)
DROP POLICY IF EXISTS "Admins can insert tax rates" ON tax_rates;
DROP POLICY IF EXISTS "Admins can read tax rates" ON tax_rates;
DROP POLICY IF EXISTS "Admins can update tax rates" ON tax_rates;
DROP POLICY IF EXISTS "Admins can delete tax rates" ON tax_rates;

-- 3. Create policies (requires is_admin() from migration 003)
-- Only authenticated admins can insert
CREATE POLICY "Admins can insert tax rates"
ON tax_rates FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Only authenticated admins can read
CREATE POLICY "Admins can read tax rates"
ON tax_rates FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Only authenticated admins can update
CREATE POLICY "Admins can update tax rates"
ON tax_rates FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Only authenticated admins can delete
CREATE POLICY "Admins can delete tax rates"
ON tax_rates FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
