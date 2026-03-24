-- Migration: 028_add_brand_new_grades.sql
-- Description: Add Brand New Sealed and Brand New Open Box to inventory grade options

-- Update the CHECK constraint to include new grades
ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_grade_check;

ALTER TABLE inventory
ADD CONSTRAINT inventory_grade_check CHECK (
  grade IN (
    'A', 'B', 'C', 'D',
    'Brand New Sealed',
    'Brand New Open Box'
  )
);

-- Update comment for documentation
COMMENT ON COLUMN inventory.grade IS 'Product condition grade: Brand New Sealed, Brand New Open Box, A (Excellent), B (Good), C (Fair), D (Damaged Stock)';
