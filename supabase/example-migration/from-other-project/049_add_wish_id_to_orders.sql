-- Migration: 049_add_wish_id_to_orders.sql
-- Description: Add wish_id column to the orders table.
--              ORDER_FIELDS in the app code includes wish_id; without this column
--              every SELECT on orders fails with "column does not exist", causing
--              the admin orders page to show 0 orders in production.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wish_id UUID REFERENCES public.wishes (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_wish_id
  ON public.orders (wish_id)
  WHERE wish_id IS NOT NULL;
