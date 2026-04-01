-- Create company_settings table to store company information and logo
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'HARI OM TRADERS LTD.',
  company_address TEXT NOT NULL DEFAULT '48 Pickard Lane, Brampton, ON, L6Y 2M5',
  hst_number TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default company settings (only one row should exist)
INSERT INTO company_settings (company_name, company_address, hst_number)
VALUES ('HARI OM TRADERS LTD.', '48 Pickard Lane, Brampton, ON, L6Y 2M5', '')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read company settings (needed for invoice generation)
CREATE POLICY "Anyone can read company settings"
  ON company_settings
  FOR SELECT
  USING (true);

-- Policy: Only admins can update company settings
CREATE POLICY "Only admins can update company settings"
  ON company_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company logos
CREATE POLICY "Anyone can view company logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY "Admins can upload company logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'company-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update company logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'company-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete company logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'company-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
