-- Migration: 038_create_company_logos_bucket.sql
-- Description: Create the company-logos Storage bucket.
--   Migration 028 added RLS policies for this bucket but never created it,
--   causing "Bucket not found" (400) on every logo upload.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880,                           -- 5 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;
