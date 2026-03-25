-- Migration 027: Add profit column to orders and deleted_orders
-- profit = (effective_selling_price - cost_per_unit) * quantity summed across all items.
-- Calculated and written by the application layer when an order is approved/completed.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS profit NUMERIC(10,2);

ALTER TABLE public.deleted_orders
  ADD COLUMN IF NOT EXISTS profit NUMERIC(10,2);
