-- Migration: 040_fix_restore_purchase_price.sql
-- Fix: When an order is deleted and stock is restored, recalculate purchase_price
--      proportionally so it always equals (cost per unit before HST) × new quantity.
--
-- Formula:
--   cost_per_unit = purchase_price / quantity          (when quantity > 0)
--   cost_per_unit = price_per_unit / (1 + hst/100)    (fallback when quantity = 0)
--   new_purchase_price = cost_per_unit × (quantity + qty_to_restore)

CREATE OR REPLACE FUNCTION public.delete_order_and_restore_inventory(
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_should_restore BOOLEAN;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can delete orders';
  END IF;

  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_should_restore :=
    COALESCE(v_order.is_manual_sale, FALSE)
    OR v_order.status IN ('approved', 'completed');

  IF v_should_restore THEN
    WITH item_deltas AS (
      SELECT
        NULLIF(value->'item'->>'id', '')::uuid AS item_id,
        GREATEST(COALESCE((value->>'quantity')::integer, 0), 0) AS qty
      FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb))
    ),
    per_item AS (
      SELECT item_id, SUM(qty) AS qty_to_restore
      FROM item_deltas
      WHERE item_id IS NOT NULL AND qty > 0
      GROUP BY item_id
    )
    UPDATE inventory i
    SET
      quantity     = i.quantity + p.qty_to_restore,
      -- Recalculate purchase_price proportionally:
      -- cost_per_unit is derived from existing purchase_price/quantity when available,
      -- otherwise falls back to price_per_unit / (1 + hst%).
      purchase_price = CASE
        WHEN i.purchase_price IS NOT NULL THEN
          ROUND(
            CASE
              WHEN i.quantity > 0
                THEN (i.purchase_price / i.quantity::numeric)
              ELSE
                (i.price_per_unit / NULLIF(1 + COALESCE(i.hst, 0) / 100.0, 0))
            END
            * (i.quantity + p.qty_to_restore)::numeric,
            2
          )
        ELSE NULL
      END,
      last_updated = 'Just now',
      updated_at   = NOW()
    FROM per_item p
    WHERE i.id = p.item_id;
  END IF;

  DELETE FROM orders WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;
