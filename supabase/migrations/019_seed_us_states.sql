-- Migration: 019_seed_us_states.sql
-- Adds all remaining USA states/territories to tax_rates.
-- Already seeded by 010: Alaska, Delaware, Montana, New Hampshire, Oregon,
--   California, New York, Texas, Florida, Washington.
-- This migration adds the remaining 45 states + D.C.
-- All rates are the base state-level sales tax rate (2025).
-- Idempotent — safe to re-run.

insert into public.tax_rates (country, state_province, tax_rate, tax_type, effective_date) values
  ('USA', 'Alabama',              4.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Arizona',              5.60,  'Sales Tax', '2025-01-01'),
  ('USA', 'Arkansas',             6.50,  'Sales Tax', '2025-01-01'),
  ('USA', 'Colorado',             2.90,  'Sales Tax', '2025-01-01'),
  ('USA', 'Connecticut',          6.35,  'Sales Tax', '2025-01-01'),
  ('USA', 'Georgia',              4.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Hawaii',               4.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Idaho',                6.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Illinois',             6.25,  'Sales Tax', '2025-01-01'),
  ('USA', 'Indiana',              7.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Iowa',                 6.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Kansas',               6.50,  'Sales Tax', '2025-01-01'),
  ('USA', 'Kentucky',             6.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Louisiana',            4.45,  'Sales Tax', '2025-01-01'),
  ('USA', 'Maine',                5.50,  'Sales Tax', '2025-01-01'),
  ('USA', 'Maryland',             6.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Massachusetts',        6.25,  'Sales Tax', '2025-01-01'),
  ('USA', 'Michigan',             6.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Minnesota',            6.88,  'Sales Tax', '2025-01-01'),
  ('USA', 'Mississippi',          7.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Missouri',             4.23,  'Sales Tax', '2025-01-01'),
  ('USA', 'Nebraska',             5.50,  'Sales Tax', '2025-01-01'),
  ('USA', 'Nevada',               6.85,  'Sales Tax', '2025-01-01'),
  ('USA', 'New Jersey',           6.63,  'Sales Tax', '2025-01-01'),
  ('USA', 'New Mexico',           4.88,  'Sales Tax', '2025-01-01'),
  ('USA', 'North Carolina',       4.75,  'Sales Tax', '2025-01-01'),
  ('USA', 'North Dakota',         5.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Ohio',                 5.75,  'Sales Tax', '2025-01-01'),
  ('USA', 'Oklahoma',             4.50,  'Sales Tax', '2025-01-01'),
  ('USA', 'Pennsylvania',         6.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Rhode Island',         7.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'South Carolina',       6.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'South Dakota',         4.50,  'Sales Tax', '2025-01-01'),
  ('USA', 'Tennessee',            7.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Utah',                 4.85,  'Sales Tax', '2025-01-01'),
  ('USA', 'Vermont',              6.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Virginia',             5.30,  'Sales Tax', '2025-01-01'),
  ('USA', 'West Virginia',        6.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Wisconsin',            5.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'Wyoming',              4.00,  'Sales Tax', '2025-01-01'),
  ('USA', 'District of Columbia', 6.00,  'Sales Tax', '2025-01-01')
on conflict (country, state_province) where city is null do nothing;
