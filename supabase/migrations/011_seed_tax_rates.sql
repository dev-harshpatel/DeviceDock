-- Migration: 011_seed_tax_rates.sql
-- Description: Seed tax rates for Canadian provinces/territories and USA states

-- Insert Canada tax rates (GST/HST)
-- 5% GST provinces/territories
INSERT INTO tax_rates (country, state_province, tax_rate, tax_type, effective_date) VALUES
('Canada', 'Alberta', 5.00, 'GST', '1991-01-01'),
('Canada', 'British Columbia', 5.00, 'GST', '1991-01-01'),
('Canada', 'Manitoba', 5.00, 'GST', '1991-01-01'),
('Canada', 'Northwest Territories', 5.00, 'GST', '1991-01-01'),
('Canada', 'Nunavut', 5.00, 'GST', '1991-01-01'),
('Canada', 'Quebec', 5.00, 'GST', '1991-01-01'),
('Canada', 'Saskatchewan', 5.00, 'GST', '1991-01-01'),
('Canada', 'Yukon', 5.00, 'GST', '1991-01-01')
ON CONFLICT (country, state_province) WHERE city IS NULL DO NOTHING;

-- 13% HST - Ontario
INSERT INTO tax_rates (country, state_province, tax_rate, tax_type, effective_date) VALUES
('Canada', 'Ontario', 13.00, 'HST', '2010-07-01')
ON CONFLICT (country, state_province) WHERE city IS NULL DO NOTHING;

-- 14% HST - Nova Scotia (effective April 1, 2025)
INSERT INTO tax_rates (country, state_province, tax_rate, tax_type, effective_date) VALUES
('Canada', 'Nova Scotia', 14.00, 'HST', '2025-04-01')
ON CONFLICT (country, state_province) WHERE city IS NULL DO NOTHING;

-- 15% HST provinces
INSERT INTO tax_rates (country, state_province, tax_rate, tax_type, effective_date) VALUES
('Canada', 'New Brunswick', 15.00, 'HST', '2010-07-01'),
('Canada', 'Newfoundland and Labrador', 15.00, 'HST', '1997-04-01'),
('Canada', 'Prince Edward Island', 15.00, 'HST', '2013-04-01')
ON CONFLICT (country, state_province) WHERE city IS NULL DO NOTHING;

-- Historical rate for Nova Scotia (15% until March 31, 2025) - for reference
-- Note: This is not inserted as current rate, but kept for historical order reference

-- Insert USA state-level sales tax rates
-- States with no sales tax (0%)
INSERT INTO tax_rates (country, state_province, tax_rate, tax_type, effective_date) VALUES
('USA', 'Alaska', 0.00, 'Sales Tax', '2025-01-01'),
('USA', 'Delaware', 0.00, 'Sales Tax', '2025-01-01'),
('USA', 'Montana', 0.00, 'Sales Tax', '2025-01-01'),
('USA', 'New Hampshire', 0.00, 'Sales Tax', '2025-01-01'),
('USA', 'Oregon', 0.00, 'Sales Tax', '2025-01-01')
ON CONFLICT (country, state_province) WHERE city IS NULL DO NOTHING;

-- USA states with sales tax (using state-level base rates)
INSERT INTO tax_rates (country, state_province, tax_rate, tax_type, effective_date) VALUES
('USA', 'Alabama', 4.00, 'Sales Tax', '2025-01-01'),
('USA', 'Arizona', 5.60, 'Sales Tax', '2025-01-01'),
('USA', 'Arkansas', 6.50, 'Sales Tax', '2025-01-01'),
('USA', 'California', 7.25, 'Sales Tax', '2025-01-01'),
('USA', 'Colorado', 2.90, 'Sales Tax', '2025-01-01'),
('USA', 'Connecticut', 6.35, 'Sales Tax', '2025-01-01'),
('USA', 'District of Columbia', 5.75, 'Sales Tax', '2025-01-01'),
('USA', 'Florida', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Georgia', 4.00, 'Sales Tax', '2025-01-01'),
('USA', 'Hawaii', 4.17, 'Sales Tax', '2025-01-01'),
('USA', 'Idaho', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Illinois', 6.25, 'Sales Tax', '2025-01-01'),
('USA', 'Indiana', 7.00, 'Sales Tax', '2025-01-01'),
('USA', 'Iowa', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Kansas', 6.50, 'Sales Tax', '2025-01-01'),
('USA', 'Kentucky', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Louisiana', 4.45, 'Sales Tax', '2025-01-01'),
('USA', 'Maine', 5.50, 'Sales Tax', '2025-01-01'),
('USA', 'Maryland', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Massachusetts', 6.25, 'Sales Tax', '2025-01-01'),
('USA', 'Michigan', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Minnesota', 6.88, 'Sales Tax', '2025-01-01'),
('USA', 'Mississippi', 7.00, 'Sales Tax', '2025-01-01'),
('USA', 'Missouri', 4.23, 'Sales Tax', '2025-01-01'),
('USA', 'Nebraska', 5.50, 'Sales Tax', '2025-01-01'),
('USA', 'Nevada', 6.85, 'Sales Tax', '2025-01-01'),
('USA', 'New Jersey', 6.63, 'Sales Tax', '2025-01-01'),
('USA', 'New Mexico', 5.13, 'Sales Tax', '2025-01-01'),
('USA', 'New York', 4.00, 'Sales Tax', '2025-01-01'),
('USA', 'North Carolina', 4.75, 'Sales Tax', '2025-01-01'),
('USA', 'North Dakota', 5.00, 'Sales Tax', '2025-01-01'),
('USA', 'Ohio', 5.75, 'Sales Tax', '2025-01-01'),
('USA', 'Oklahoma', 4.50, 'Sales Tax', '2025-01-01'),
('USA', 'Pennsylvania', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Rhode Island', 7.00, 'Sales Tax', '2025-01-01'),
('USA', 'South Carolina', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'South Dakota', 4.50, 'Sales Tax', '2025-01-01'),
('USA', 'Tennessee', 7.00, 'Sales Tax', '2025-01-01'),
('USA', 'Texas', 6.25, 'Sales Tax', '2025-01-01'),
('USA', 'Utah', 6.10, 'Sales Tax', '2025-01-01'),
('USA', 'Vermont', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Virginia', 5.30, 'Sales Tax', '2025-01-01'),
('USA', 'Washington', 6.50, 'Sales Tax', '2025-01-01'),
('USA', 'West Virginia', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Wisconsin', 5.00, 'Sales Tax', '2025-01-01'),
('USA', 'Wyoming', 4.00, 'Sales Tax', '2025-01-01')
ON CONFLICT (country, state_province) WHERE city IS NULL DO NOTHING;
