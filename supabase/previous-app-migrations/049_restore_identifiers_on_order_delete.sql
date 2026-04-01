-- Migration: 049_restore_identifiers_on_order_delete.sql
-- When an order is deleted, per-unit IMEI/serial rows must return to sellable state.
-- Order lines store inventoryIdentifierId (camelCase) on manual / IMEI sales.

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

    -- Per-unit IMEI/serial: mark units available again (same as revertInventoryIdentifierSold)
    WITH identifier_ids AS (
      SELECT DISTINCT NULLIF(trim(value->>'inventoryIdentifierId'), '')::uuid AS id
      FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb)) AS t(value)
      WHERE NULLIF(trim(value->>'inventoryIdentifierId'), '') IS NOT NULL
    )
    UPDATE public.inventory_identifiers ii
    SET
      status = 'in_stock',
      sold_at = NULL,
      updated_at = NOW()
    FROM identifier_ids x
    WHERE ii.id = x.id
      AND ii.company_id = v_order.company_id
      AND ii.status = 'sold';
  END IF;

  DELETE FROM orders WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;
