-- Create the company_settings table with proper multi-tenant company_id FK.
--
-- The legacy single-tenant company_settings (from old migration 023) had no
-- company_id column, which broke RLS tenant-isolation policies in migration 021.
-- This migration creates the table correctly — or adds the missing columns if
-- a partial legacy table already exists.

-- ── Create if not present ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_settings (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                 UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name               TEXT        NOT NULL DEFAULT '',
  company_address            TEXT        NOT NULL DEFAULT '',
  hst_number                 TEXT        NOT NULL DEFAULT '',
  logo_url                   TEXT,
  push_notifications_enabled BOOLEAN     NOT NULL DEFAULT true,
  low_stock_threshold        INTEGER     NOT NULL DEFAULT 5,
  critical_stock_threshold   INTEGER     NOT NULL DEFAULT 2,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

-- ── Additive columns for tables that existed without them ───────────────────
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS company_id                 UUID        REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS low_stock_threshold        INTEGER     NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS critical_stock_threshold   INTEGER     NOT NULL DEFAULT 2;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies that referenced the old schema
DROP POLICY IF EXISTS "Anyone can read company settings"        ON public.company_settings;
DROP POLICY IF EXISTS "Only admins can update company settings" ON public.company_settings;
DROP POLICY IF EXISTS "company_members_read_company_settings"   ON public.company_settings;
DROP POLICY IF EXISTS "company_owners_write_company_settings"   ON public.company_settings;

-- Active members of the company can read settings
CREATE POLICY "company_members_read_company_settings"
  ON public.company_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = company_settings.company_id
        AND cu.status     = 'active'
    )
  );

-- Owners and managers can insert / update / delete settings
CREATE POLICY "company_owners_write_company_settings"
  ON public.company_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = company_settings.company_id
        AND cu.role       IN ('owner', 'manager')
        AND cu.status     = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = company_settings.company_id
        AND cu.role       IN ('owner', 'manager')
        AND cu.status     = 'active'
    )
  );

-- ── Updated-at trigger ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS company_settings_set_updated_at ON public.company_settings;
CREATE TRIGGER company_settings_set_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
