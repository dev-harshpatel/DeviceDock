-- Migration: 030_imei_inventory_foundation.sql
-- Description: Schema foundations for IMEI/Serial tracking, status lifecycle, and sales.

-- 1. Inventory Modifications
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='status') THEN
        ALTER TABLE public.inventory
        ADD COLUMN imei text,
        ADD COLUMN serial_number text,
        ADD COLUMN status text DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'reserved', 'sold', 'returned', 'damaged')),
        ADD COLUMN sold_at timestamptz;
    END IF;
END $$;

-- 2. Identifier uniqueness for active items (Scoped by company)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_active_imei 
ON public.inventory (company_id, imei) 
WHERE imei IS NOT NULL AND status IN ('in_stock', 'reserved');

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_active_serial_number 
ON public.inventory (company_id, serial_number) 
WHERE serial_number IS NOT NULL AND status IN ('in_stock', 'reserved');

-- 3. Identifier constraint
-- NOT VALID ensures existing database entries don't break the migration, but it will enforce for any new inserts/updates.
ALTER TABLE public.inventory 
    ADD CONSTRAINT inventory_identifier_check 
    CHECK (imei IS NOT NULL OR serial_number IS NOT NULL) NOT VALID;

-- 4. Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL UNIQUE REFERENCES public.inventory(id) ON DELETE CASCADE,
  sold_price numeric(10, 2) NOT NULL,
  sold_at timestamptz NOT NULL DEFAULT now(),
  sold_by uuid NOT NULL REFERENCES auth.users(id),
  reference_number text,
  notes text,
  payment_mode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.inventory_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  metadata jsonb,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Bulk Sessions Table
CREATE TABLE IF NOT EXISTS public.bulk_import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  shared_payload jsonb,
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'partial', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_imei ON public.inventory(imei);
CREATE INDEX IF NOT EXISTS idx_inventory_serial_number ON public.inventory(serial_number);

CREATE INDEX IF NOT EXISTS idx_sales_company_id ON public.sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_inventory_id ON public.sales(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON public.sales(sold_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_activity_logs_company_id ON public.inventory_activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_activity_logs_inventory_id ON public.inventory_activity_logs(inventory_id);

CREATE INDEX IF NOT EXISTS idx_bulk_import_sessions_company_id ON public.bulk_import_sessions(company_id);

-- 8. Updated At Triggers
DROP TRIGGER IF EXISTS sales_set_updated_at ON public.sales;
CREATE TRIGGER sales_set_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS bulk_import_sessions_set_updated_at ON public.bulk_import_sessions;
CREATE TRIGGER bulk_import_sessions_set_updated_at
BEFORE UPDATE ON public.bulk_import_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
