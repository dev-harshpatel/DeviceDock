-- DEBUG: Run this in Supabase SQL Editor to add RAISE NOTICE logging.
-- Check Supabase Dashboard > Logs > Postgres for output.
-- Revert by re-running migration 036 when done.

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
  v_item_delta RECORD;
  v_per_item RECORD;
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
    RAISE NOTICE '[delete_order] Order not found: %', p_order_id;
    RETURN FALSE;
  END IF;

  RAISE NOTICE '[delete_order] Order found: id=%, status=%, is_manual_sale=%, items_count=%',
    p_order_id, v_order.status, v_order.is_manual_sale,
    jsonb_array_length(COALESCE(v_order.items, '[]'::jsonb));

  v_should_restore :=
    COALESCE(v_order.is_manual_sale, FALSE)
    OR v_order.status IN ('approved', 'completed');

  RAISE NOTICE '[delete_order] v_should_restore=%', v_should_restore;

  IF v_should_restore THEN
    -- Log raw items JSON
    RAISE NOTICE '[delete_order] items JSON: %', v_order.items;

    -- Log each raw element
    FOR v_item_delta IN
      SELECT
        value AS raw_value,
        NULLIF(value->'item'->>'id', '')::uuid AS item_id,
        GREATEST(COALESCE((value->>'quantity')::integer, 0), 0) AS qty
      FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb))
    LOOP
      RAISE NOTICE '[delete_order] item_delta: item_id=%, qty=%',
        v_item_delta.item_id, v_item_delta.qty;
    END LOOP;

    -- Log aggregated per-item restore amounts + inventory qty BEFORE restore
    FOR v_per_item IN
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
      SELECT p.item_id, p.qty_to_restore, i.quantity AS inv_qty_before
      FROM per_item p
      JOIN inventory i ON i.id = p.item_id
    LOOP
      RAISE NOTICE '[delete_order] BEFORE restore: item_id=%, inv_qty=%, adding=%',
        v_per_item.item_id, v_per_item.inv_qty_before, v_per_item.qty_to_restore;
    END LOOP;

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
  RAISE NOTICE '[delete_order] Order deleted: %', p_order_id;
  RETURN TRUE;
END;
$$;
