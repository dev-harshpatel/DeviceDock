-- Migration: 002_rls_policies.sql
-- Description: Enable Row Level Security and create policies for all tables

-- Enable Row Level Security on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USER_PROFILES POLICIES
-- ============================================

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
ON user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can update any profile (for role management)
CREATE POLICY "Admins can update any profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- INVENTORY POLICIES
-- ============================================

-- Policy: Public read access (for browsing without login)
CREATE POLICY "Public can read inventory"
ON inventory FOR SELECT
TO public
USING (true);

-- Policy: Authenticated users can read inventory
CREATE POLICY "Authenticated can read inventory"
ON inventory FOR SELECT
TO authenticated
USING (true);

-- Policy: Only admins can insert inventory
CREATE POLICY "Admins can insert inventory"
ON inventory FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Only admins can update inventory
CREATE POLICY "Admins can update inventory"
ON inventory FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Only admins can delete inventory
CREATE POLICY "Admins can delete inventory"
ON inventory FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- ORDERS POLICIES
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

-- Policy: Admins can read all orders
CREATE POLICY "Admins can read all orders"
ON orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Admins can update all orders (for status changes)
CREATE POLICY "Admins can update all orders"
ON orders FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Users cannot update their own orders (only admins can)
-- This is enforced by not having a policy for users to update

-- Policy: Only admins can delete orders
CREATE POLICY "Admins can delete orders"
ON orders FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
