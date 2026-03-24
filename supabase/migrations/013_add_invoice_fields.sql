-- Migration: 013_add_invoice_fields.sql
-- Description: Add invoice-related columns to orders table

-- Add invoice-related columns to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS invoice_date DATE,
ADD COLUMN IF NOT EXISTS po_number TEXT,
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS hst_number TEXT,
ADD COLUMN IF NOT EXISTS invoice_notes TEXT,
ADD COLUMN IF NOT EXISTS invoice_terms TEXT,
ADD COLUMN IF NOT EXISTS invoice_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS invoice_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups by invoice number
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number);

-- Create index for invoice confirmation status
CREATE INDEX IF NOT EXISTS idx_orders_invoice_confirmed ON orders(invoice_confirmed);

-- Add comments for documentation
COMMENT ON COLUMN orders.invoice_number IS 'Invoice number in format #NN + DDMMYY (e.g., #01212026)';
COMMENT ON COLUMN orders.invoice_date IS 'Invoice date (defaults to order date)';
COMMENT ON COLUMN orders.po_number IS 'Purchase order number (same format as invoice number)';
COMMENT ON COLUMN orders.payment_terms IS 'Payment terms (e.g., CHQ, NET 30, Due on Receipt)';
COMMENT ON COLUMN orders.due_date IS 'Payment due date';
COMMENT ON COLUMN orders.hst_number IS 'Company HST registration number';
COMMENT ON COLUMN orders.invoice_notes IS 'Additional notes for invoice';
COMMENT ON COLUMN orders.invoice_terms IS 'Terms and conditions for invoice';
COMMENT ON COLUMN orders.invoice_confirmed IS 'Whether admin has confirmed invoice (user can download only if true)';
COMMENT ON COLUMN orders.invoice_confirmed_at IS 'Timestamp when invoice was confirmed by admin';
