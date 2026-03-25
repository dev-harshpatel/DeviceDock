-- Migration: 046_add_profit_column.sql
-- Description: Add profit column to orders and deleted_orders tables.
--              Profit is calculated as (effective_selling_price - cost_per_unit) * quantity
--              for all items in an order, where effective_selling_price is the custom
--              per-order override price (if set) or the default selling price.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS profit NUMERIC(10,2);

ALTER TABLE public.deleted_orders
  ADD COLUMN IF NOT EXISTS profit NUMERIC(10,2);
