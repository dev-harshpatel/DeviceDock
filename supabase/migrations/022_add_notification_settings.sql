-- Add notification preferences and stock threshold settings to company_settings.
-- These are admin-controlled and drive the bell icon badge and alert derivation logic.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS critical_stock_threshold INTEGER NOT NULL DEFAULT 2;
