-- Migration: 027_add_product_uploads_rls.sql
-- Description: Add RLS policies for product_uploads table
-- Fixes 403 Forbidden when uploading products in production (table had no policies)

-- Enable RLS (idempotent - no-op if already enabled)
ALTER TABLE product_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can insert upload records
CREATE POLICY "Admins can insert product uploads"
ON product_uploads FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Policy: Only admins can read upload history
CREATE POLICY "Admins can read product uploads"
ON product_uploads FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Policy: Only admins can update upload records (e.g. status after bulk insert)
CREATE POLICY "Admins can update product uploads"
ON product_uploads FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));
