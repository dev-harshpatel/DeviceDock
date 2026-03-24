-- Migration: 003_fix_rls_recursion.sql
-- Description: Fix infinite recursion in RLS policies by using security definer function

-- IMPORTANT: Run this migration AFTER 002_rls_policies.sql
-- This fixes the infinite recursion issue

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can update inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can delete inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can read all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

-- Drop the function if it exists (to recreate it)
DROP FUNCTION IF EXISTS is_admin(UUID);

-- Create a security definer function to check if user is admin
-- SECURITY DEFINER means it runs with postgres user privileges, bypassing RLS
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This query bypasses RLS because the function runs as postgres
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_profiles
    WHERE user_profiles.user_id = check_user_id 
      AND user_profiles.role = 'admin'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO anon;

-- ============================================
-- USER_PROFILES POLICIES (Fixed - using function)
-- ============================================

-- Policy: Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Policy: Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================
-- INVENTORY POLICIES (Fixed - using function)
-- ============================================

-- Policy: Only admins can insert inventory
CREATE POLICY "Admins can insert inventory"
ON inventory FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Policy: Only admins can update inventory
CREATE POLICY "Admins can update inventory"
ON inventory FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- Policy: Only admins can delete inventory
CREATE POLICY "Admins can delete inventory"
ON inventory FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- ============================================
-- ORDERS POLICIES (Fixed - using function)
-- ============================================

-- Policy: Admins can read all orders
CREATE POLICY "Admins can read all orders"
ON orders FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Policy: Admins can update all orders
CREATE POLICY "Admins can update all orders"
ON orders FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- Policy: Only admins can delete orders
CREATE POLICY "Admins can delete orders"
ON orders FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
