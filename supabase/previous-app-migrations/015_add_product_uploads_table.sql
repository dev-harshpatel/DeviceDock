-- Migration: 015_add_product_uploads_table.sql
-- Description: Create table to track product uploads via Excel files

-- Create product_uploads table
CREATE TABLE IF NOT EXISTS product_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  total_products INTEGER NOT NULL DEFAULT 0,
  successful_inserts INTEGER NOT NULL DEFAULT 0,
  failed_inserts INTEGER NOT NULL DEFAULT 0,
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_uploads_uploaded_by ON product_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_product_uploads_created_at ON product_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_uploads_status ON product_uploads(upload_status);

-- Add comment for documentation
COMMENT ON TABLE product_uploads IS 'Tracks product uploads via Excel files with metadata and statistics';
