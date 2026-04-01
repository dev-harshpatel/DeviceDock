-- Migration: 010_create_tax_rates.sql
-- Description: Create tax_rates table for storing HST/GST and sales tax rates by location

-- Create tax_rates table
CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  state_province TEXT NOT NULL,
  city TEXT,
  tax_rate DECIMAL(5, 2) NOT NULL,
  tax_type TEXT NOT NULL CHECK (tax_type IN ('GST', 'HST', 'Sales Tax')),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tax_rates_country ON tax_rates(country);
CREATE INDEX IF NOT EXISTS idx_tax_rates_state_province ON tax_rates(state_province);
CREATE INDEX IF NOT EXISTS idx_tax_rates_city ON tax_rates(city);
CREATE INDEX IF NOT EXISTS idx_tax_rates_country_state ON tax_rates(country, state_province);
CREATE INDEX IF NOT EXISTS idx_tax_rates_country_state_city ON tax_rates(country, state_province, city);

-- Create unique constraint for state-level rates (city IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rates_unique_state 
ON tax_rates(country, state_province) 
WHERE city IS NULL;

-- Create unique constraint for city-level rates (city IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rates_unique_city 
ON tax_rates(country, state_province, city) 
WHERE city IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE tax_rates IS 'Tax rates (HST/GST/Sales Tax) by country, state/province, and optionally city';
COMMENT ON COLUMN tax_rates.country IS 'Country code: Canada or USA';
COMMENT ON COLUMN tax_rates.state_province IS 'State or province name';
COMMENT ON COLUMN tax_rates.city IS 'City name (optional, for city-specific rates)';
COMMENT ON COLUMN tax_rates.tax_rate IS 'Tax rate as percentage (e.g., 13.00 for 13%)';
COMMENT ON COLUMN tax_rates.tax_type IS 'Type of tax: GST, HST, or Sales Tax';
COMMENT ON COLUMN tax_rates.effective_date IS 'Date when this tax rate became effective';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tax_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tax_rates_updated_at
  BEFORE UPDATE ON tax_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_rates_updated_at();
