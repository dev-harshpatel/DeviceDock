-- Migration: 004_verify_and_fix_orders.sql
-- Description: Verify and fix RLS policies to ensure admins can see and update all orders

-- First, verify the is_admin function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND pronargs = 1
  ) THEN
    RAISE EXCEPTION 'is_admin function does not exist. Please run migration 003_fix_rls_recursion.sql first.';
  END IF;
END $$;

-- Drop ALL existing order policies to start fresh
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Users can read own orders" ON orders;
DROP POLICY IF EXISTS "Admins can read all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;

-- ============================================
-- ORDERS POLICIES (Recreated with proper function)
-- ============================================

-- Policy: Users can insert their own orders
CREATE POLICY "Users can insert own orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read their own orders
CREATE POLICY "Users can read own orders"
ON orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admins can read all orders (using function - no recursion)
CREATE POLICY "Admins can read all orders"
ON orders FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Policy: Admins can update all orders (using function - no recursion)
CREATE POLICY "Admins can update all orders"
ON orders FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Policy: Only admins can delete orders
CREATE POLICY "Admins can delete orders"
ON orders FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'orders';
  
  IF policy_count < 5 THEN
    RAISE WARNING 'Expected 5 policies on orders table, found %', policy_count;
  ELSE
    RAISE NOTICE 'Successfully created % policies on orders table', policy_count;
  END IF;
END $$;
