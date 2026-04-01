-- Cherry-picked from legacy 011.
-- Idempotent seed inserts.

insert into public.tax_rates (country, state_province, tax_rate, tax_type, effective_date) values
('Canada', 'Alberta', 5.00, 'GST', '1991-01-01'),
('Canada', 'British Columbia', 5.00, 'GST', '1991-01-01'),
('Canada', 'Manitoba', 5.00, 'GST', '1991-01-01'),
('Canada', 'Northwest Territories', 5.00, 'GST', '1991-01-01'),
('Canada', 'Nunavut', 5.00, 'GST', '1991-01-01'),
('Canada', 'Quebec', 5.00, 'GST', '1991-01-01'),
('Canada', 'Saskatchewan', 5.00, 'GST', '1991-01-01'),
('Canada', 'Yukon', 5.00, 'GST', '1991-01-01')
on conflict (country, state_province) where city is null do nothing;

insert into public.tax_rates (country, state_province, tax_rate, tax_type, effective_date) values
('Canada', 'Ontario', 13.00, 'HST', '2010-07-01'),
('Canada', 'Nova Scotia', 14.00, 'HST', '2025-04-01'),
('Canada', 'New Brunswick', 15.00, 'HST', '2010-07-01'),
('Canada', 'Newfoundland and Labrador', 15.00, 'HST', '1997-04-01'),
('Canada', 'Prince Edward Island', 15.00, 'HST', '2013-04-01')
on conflict (country, state_province) where city is null do nothing;

insert into public.tax_rates (country, state_province, tax_rate, tax_type, effective_date) values
('USA', 'Alaska', 0.00, 'Sales Tax', '2025-01-01'),
('USA', 'Delaware', 0.00, 'Sales Tax', '2025-01-01'),
('USA', 'Montana', 0.00, 'Sales Tax', '2025-01-01'),
('USA', 'New Hampshire', 0.00, 'Sales Tax', '2025-01-01'),
('USA', 'Oregon', 0.00, 'Sales Tax', '2025-01-01')
on conflict (country, state_province) where city is null do nothing;

insert into public.tax_rates (country, state_province, tax_rate, tax_type, effective_date) values
('USA', 'California', 7.25, 'Sales Tax', '2025-01-01'),
('USA', 'New York', 4.00, 'Sales Tax', '2025-01-01'),
('USA', 'Texas', 6.25, 'Sales Tax', '2025-01-01'),
('USA', 'Florida', 6.00, 'Sales Tax', '2025-01-01'),
('USA', 'Washington', 6.50, 'Sales Tax', '2025-01-01')
on conflict (country, state_province) where city is null do nothing;
