-- Migration: 036_fix_delete_order_restore_exact_qty.sql
-- Description: Ensure delete-order restore uses exact aggregated qty per item and runs once.

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
      quantity = i.quantity + p.qty_to_restore,
      last_updated = 'Just now',
      updated_at = NOW()
    FROM per_item p
    WHERE i.id = p.item_id;
  END IF;

  DELETE FROM orders WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;

