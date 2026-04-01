-- Migration: 008_add_grade_d.sql
-- Description: Add grade 'D' (Damaged Stock) to inventory table

-- Update the CHECK constraint to include grade 'D'
ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_grade_check;

ALTER TABLE inventory
ADD CONSTRAINT inventory_grade_check CHECK (grade IN ('A', 'B', 'C', 'D'));

-- Add comment for documentation
COMMENT ON COLUMN inventory.grade IS 'Product condition grade: A (Excellent), B (Good), C (Fair), D (Damaged Stock)';
