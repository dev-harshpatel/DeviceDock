-- Migration: 048_add_wish_id_to_deleted_orders.sql
-- Description: Align deleted_orders with orders: wish_id was missing, so PostgREST
--              SELECTs using ORDER_FIELDS (including wish_id) failed and the UI showed no rows.
--              Also archive profit and wish_id when deleting an order.

ALTER TABLE public.deleted_orders
  ADD COLUMN IF NOT EXISTS wish_id UUID;

CREATE OR REPLACE FUNCTION public.delete_order_and_restore_inventory(
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order          RECORD;
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

  INSERT INTO deleted_orders (
    id, user_id, items, subtotal, tax_rate, tax_amount, total_price,
    status, created_at, updated_at, rejection_reason, rejection_comment,
    invoice_number, invoice_date, po_number, payment_terms, due_date,
    hst_number, invoice_notes, invoice_terms, invoice_confirmed, invoice_confirmed_at,
    discount_amount, discount_type, shipping_amount, shipping_address, billing_address,
    imei_numbers, is_manual_sale, manual_customer_name, manual_customer_email,
    manual_customer_phone, profit, wish_id, deleted_at
  ) VALUES (
    v_order.id, v_order.user_id, v_order.items, v_order.subtotal, v_order.tax_rate,
    v_order.tax_amount, v_order.total_price, v_order.status, v_order.created_at,
    v_order.updated_at, v_order.rejection_reason, v_order.rejection_comment,
    v_order.invoice_number, v_order.invoice_date, v_order.po_number, v_order.payment_terms,
    v_order.due_date, v_order.hst_number, v_order.invoice_notes, v_order.invoice_terms,
    v_order.invoice_confirmed, v_order.invoice_confirmed_at, v_order.discount_amount,
    v_order.discount_type, v_order.shipping_amount, v_order.shipping_address,
    v_order.billing_address, v_order.imei_numbers, v_order.is_manual_sale,
    v_order.manual_customer_name, v_order.manual_customer_email, v_order.manual_customer_phone,
    v_order.profit, v_order.wish_id,
    NOW()
  );

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
      last_updated = 'Just now',
      updated_at   = NOW()
    FROM per_item p
    WHERE i.id = p.item_id;
  END IF;

  DELETE FROM orders WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;
