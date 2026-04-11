-- Migration: 005_diagnose_and_fix_rls.sql
-- Description: Comprehensive diagnostic and fix for RLS policies

-- ============================================
-- STEP 1: DIAGNOSTIC QUERIES
-- ============================================

-- Check if is_admin function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND pronargs = 1
  ) THEN
    RAISE EXCEPTION 'ERROR: is_admin function does not exist. Run migration 003 first.';
  ELSE
    RAISE NOTICE '✓ is_admin function exists';
  END IF;
END $$;

-- Check current user_profiles policies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_profiles';
  RAISE NOTICE 'Current user_profiles policies: %', policy_count;
END $$;

-- Check current orders policies
DO $$
DECLARE
  policy_count INTEGER;
  policy_names TEXT;
BEGIN
  SELECT COUNT(*), string_agg(policyname, ', ')
  INTO policy_count, policy_names
  FROM pg_policies
  WHERE tablename = 'orders';
  RAISE NOTICE 'Current orders policies: %', policy_count;
  RAISE NOTICE 'Policy names: %', policy_names;
END $$;

-- ============================================
-- STEP 2: DROP ALL EXISTING POLICIES
-- ============================================

-- Drop ALL orders policies (we'll recreate them cleanly)
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Users can read own orders" ON orders;
DROP POLICY IF EXISTS "Admins can read all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can read own orders" ON orders;

-- ============================================
-- STEP 3: RECREATE POLICIES CORRECTLY
-- ============================================

-- IMPORTANT: In Supabase RLS, multiple SELECT policies are combined with OR
-- So if a user matches ANY policy, they can see the rows

-- Policy 1: Users can insert their own orders
CREATE POLICY "Users can insert own orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Users can read their own orders
-- This allows regular users to see only their orders
CREATE POLICY "Users can read own orders"
ON orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 3: Admins can read ALL orders
-- This allows admins to see all orders (combined with Policy 2 via OR)
CREATE POLICY "Admins can read all orders"
ON orders FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Policy 4: Admins can update all orders
CREATE POLICY "Admins can update all orders"
ON orders FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Policy 5: Admins can delete orders
CREATE POLICY "Admins can delete orders"
ON orders FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- ============================================
-- STEP 4: VERIFY POLICIES
-- ============================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'orders';
  
  IF policy_count < 5 THEN
    RAISE WARNING 'Expected 5 policies on orders, found %', policy_count;
  ELSE
    RAISE NOTICE '✓ Successfully created % policies on orders table', policy_count;
  END IF;
END $$;

-- ============================================
-- STEP 5: TEST QUERIES (for manual verification)
-- ============================================

-- Uncomment these to test manually (replace with your admin user_id):
-- SELECT is_admin('YOUR_ADMIN_USER_ID_HERE');
-- SELECT COUNT(*) FROM orders; -- Should return 4 if you're admin
-- SELECT * FROM orders; -- Should show all 4 orders if you're admin
