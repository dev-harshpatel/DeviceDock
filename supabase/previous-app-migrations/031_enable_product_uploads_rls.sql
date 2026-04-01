-- Enable RLS on product_uploads: only authenticated users with admin role can access
-- Run this in Supabase SQL Editor or via: npx supabase db push

-- 1. Enable Row Level Security
ALTER TABLE product_uploads ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist (idempotent for re-runs)
DROP POLICY IF EXISTS "Admins can insert product uploads" ON product_uploads;
DROP POLICY IF EXISTS "Admins can read product uploads" ON product_uploads;
DROP POLICY IF EXISTS "Admins can update product uploads" ON product_uploads;
DROP POLICY IF EXISTS "Admins can delete product uploads" ON product_uploads;

-- 3. Create policies (requires is_admin() from migration 003)
-- Only authenticated admins can insert
CREATE POLICY "Admins can insert product uploads"
ON product_uploads FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Only authenticated admins can read
CREATE POLICY "Admins can read product uploads"
ON product_uploads FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Only authenticated admins can update
CREATE POLICY "Admins can update product uploads"
ON product_uploads FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Only authenticated admins can delete
CREATE POLICY "Admins can delete product uploads"
ON product_uploads FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
