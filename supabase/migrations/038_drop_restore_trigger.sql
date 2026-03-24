-- Migration: 038_drop_restore_trigger.sql
-- Fix: Double restore on order delete.
-- Cause: restore_inventory_after_order_delete trigger fires on DELETE and restores again
--       after delete_order_and_restore_inventory already restores and deletes.
-- Fix: Drop the trigger so only the RPC restores inventory.

DROP TRIGGER IF EXISTS restore_inventory_after_order_delete ON public.orders;
