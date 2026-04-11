-- Migration: 033_restore_identifiers_on_order_delete.sql
-- Replaces delete_order_and_restore_inventory to:
--   1. Authorize via company_users (owner/manager) — NOT is_admin(uuid), removed in 021
--   2. Archive to deleted_orders (same as 026)
--   3. Restore inventory qty + purchase_price
--   4. Restore IMEI/serial rows (inventory_identifiers) to in_stock
--   5. Delete the order row

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
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id    = auth.uid()
      AND cu.company_id = v_order.company_id
      AND cu.role       IN ('owner', 'manager')
      AND cu.status     = 'active'
  ) THEN
    RAISE EXCEPTION 'Only company owners or managers can delete orders';
  END IF;

  INSERT INTO public.deleted_orders (
    id, company_id, user_id, items,
    subtotal, tax_rate, tax_amount, total_price,
    status, created_at, updated_at,
    rejection_reason, rejection_comment,
    invoice_number, invoice_date, po_number, payment_terms, due_date,
    hst_number, invoice_notes, invoice_terms,
    invoice_confirmed, invoice_confirmed_at,
    discount_amount, discount_type,
    shipping_amount, shipping_address, billing_address,
    imei_numbers,
    is_manual_sale, manual_customer_name, manual_customer_email, manual_customer_phone,
    deleted_at
  ) VALUES (
    v_order.id, v_order.company_id, v_order.user_id, v_order.items,
    v_order.subtotal, v_order.tax_rate, v_order.tax_amount, v_order.total_price,
    v_order.status, v_order.created_at, v_order.updated_at,
    v_order.rejection_reason, v_order.rejection_comment,
    v_order.invoice_number, v_order.invoice_date, v_order.po_number,
    v_order.payment_terms, v_order.due_date,
    v_order.hst_number, v_order.invoice_notes, v_order.invoice_terms,
    v_order.invoice_confirmed, v_order.invoice_confirmed_at,
    v_order.discount_amount, v_order.discount_type,
    v_order.shipping_amount, v_order.shipping_address, v_order.billing_address,
    v_order.imei_numbers,
    v_order.is_manual_sale, v_order.manual_customer_name,
    v_order.manual_customer_email, v_order.manual_customer_phone,
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
    UPDATE public.inventory i
    SET
      quantity = i.quantity + p.qty_to_restore,
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

    -- Per-unit IMEI/serial: mark units available again
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

  DELETE FROM public.orders WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_order_and_restore_inventory(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_order_and_restore_inventory(UUID) TO authenticated;
