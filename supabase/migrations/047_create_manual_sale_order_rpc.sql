-- Migration: 047_create_manual_sale_order_rpc.sql
-- Atomic RPC for creating a manual sale order.
-- Replaces the prior 3-step client-side flow (insert order → mark identifiers sold →
-- decrement inventory) which left orders approved with stale inventory if any step failed.
-- Everything now runs in a single PG transaction: either all succeeds or nothing is committed.

CREATE OR REPLACE FUNCTION public.create_manual_sale_order(
  p_order_id              uuid,
  p_user_id               uuid,
  p_company_id            uuid,
  p_items                 jsonb,
  p_subtotal              numeric,
  p_total_price           numeric,
  p_manual_customer_name  text,
  p_tax_rate              numeric  DEFAULT NULL,
  p_tax_amount            numeric  DEFAULT NULL,
  p_manual_customer_email text     DEFAULT NULL,
  p_manual_customer_phone text     DEFAULT NULL,
  p_payment_terms         text     DEFAULT NULL,
  p_billing_address       text     DEFAULT NULL,
  p_shipping_address      text     DEFAULT NULL,
  p_invoice_notes         text     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_elem       jsonb;
  v_item_id    uuid;
  v_qty        integer;
  v_ident      text;
  v_inv_qty    integer;
  v_inv_pp     numeric;
  v_new_qty    integer;
  v_new_pp     numeric;
  -- profit computation (mirrors 035_update_manual_sale_order logic)
  v_profit     numeric := 0;
  v_sell       numeric;
  v_snap_qty   numeric;
  v_pp_snap    numeric;
  v_hst        numeric;
  v_ppu        numeric;
  v_cost_unit  numeric;
  v_line_rev   numeric;
  v_line_cost  numeric;
BEGIN
  -- Authorization: caller must be an active company member with the right role
  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id    = auth.uid()
      AND cu.company_id = p_company_id
      AND cu.role       IN ('owner', 'manager', 'inventory_admin')
      AND cu.status     = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to create manual sale orders';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items must be a non-empty JSON array';
  END IF;

  -- 1) Validate, decrement inventory, mark identifiers sold — one item at a time
  FOR v_elem IN
    SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := NULLIF(trim(v_elem->'item'->>'id'), '')::uuid;
    v_qty     := GREATEST(COALESCE((v_elem->>'quantity')::integer, 0), 0);
    v_ident   := NULLIF(trim(v_elem->>'inventoryIdentifierId'), '');

    IF v_item_id IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid line: missing item id or quantity';
    END IF;

    SELECT i.quantity, i.purchase_price
    INTO   v_inv_qty, v_inv_pp
    FROM   public.inventory i
    WHERE  i.id         = v_item_id
      AND  i.company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found: %', v_item_id;
    END IF;

    IF v_inv_qty < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_item_id;
    END IF;

    -- For identifier lines: validate the unit is still available
    IF v_ident IS NOT NULL THEN
      IF v_qty <> 1 THEN
        RAISE EXCEPTION 'Identifier lines must have quantity 1 (got %) for unit %', v_qty, v_ident;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM   public.inventory_identifiers ii
        WHERE  ii.id           = v_ident::uuid
          AND  ii.company_id   = p_company_id
          AND  ii.inventory_id = v_item_id
          AND  ii.status       IN ('in_stock', 'reserved')
      ) THEN
        RAISE EXCEPTION 'IMEI/serial unit not available (already sold or not found): %', v_ident;
      END IF;
    END IF;

    -- Decrement inventory quantity and scale purchase_price proportionally
    v_new_qty := v_inv_qty - v_qty;

    IF v_inv_pp IS NOT NULL AND v_inv_qty > 0 THEN
      v_new_pp := ROUND((v_inv_pp / v_inv_qty::numeric) * v_new_qty::numeric, 2);
    ELSE
      v_new_pp := v_inv_pp;
    END IF;

    UPDATE public.inventory i
    SET
      quantity       = v_new_qty,
      purchase_price = v_new_pp,
      last_updated   = 'Just now',
      updated_at     = NOW()
    WHERE  i.id         = v_item_id
      AND  i.company_id = p_company_id;

    -- Mark identifier sold (atomic with the quantity decrement)
    IF v_ident IS NOT NULL THEN
      UPDATE public.inventory_identifiers ii
      SET
        status     = 'sold',
        sold_at    = NOW(),
        updated_at = NOW()
      WHERE  ii.id         = v_ident::uuid
        AND  ii.company_id = p_company_id
        AND  ii.status     IN ('in_stock', 'reserved');

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to mark identifier sold (concurrent sale?): %', v_ident;
      END IF;
    END IF;
  END LOOP;

  -- 2) Compute profit (mirrors 035 logic: revenue − cost per line)
  FOR v_elem IN
    SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_sell := COALESCE(
      NULLIF(trim(v_elem->'item'->>'sellingPrice'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'selling_price'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'pricePerUnit'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'price_per_unit'), '')::numeric,
      0::numeric
    );
    v_qty := GREATEST(COALESCE((v_elem->>'quantity')::integer, 0), 0);
    v_line_rev := v_sell * v_qty;

    v_snap_qty := COALESCE(NULLIF(trim(v_elem->'item'->>'quantity'), '')::numeric, 0::numeric);
    v_pp_snap  := COALESCE(
      NULLIF(trim(v_elem->'item'->>'purchasePrice'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'purchase_price'), '')::numeric,
      NULL::numeric
    );
    v_hst := COALESCE(NULLIF(trim(v_elem->'item'->>'hst'), '')::numeric, 0::numeric);
    v_ppu := COALESCE(
      NULLIF(trim(v_elem->'item'->>'pricePerUnit'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'price_per_unit'), '')::numeric,
      0::numeric
    );

    IF v_pp_snap IS NOT NULL AND v_snap_qty > 0 THEN
      v_cost_unit := v_pp_snap / v_snap_qty;
    ELSIF v_hst > 0 AND v_ppu > 0 THEN
      v_cost_unit := v_ppu / NULLIF(1 + v_hst / 100.0, 0);
    ELSE
      v_cost_unit := v_ppu;
    END IF;

    v_line_cost := v_cost_unit * v_qty;
    v_profit    := v_profit + (v_line_rev - v_line_cost);
  END LOOP;

  v_profit := ROUND(v_profit, 2);

  -- 3) Insert the order row (all inventory + identifier state already committed above)
  INSERT INTO public.orders (
    id,
    user_id,
    company_id,
    items,
    subtotal,
    tax_rate,
    tax_amount,
    total_price,
    profit,
    status,
    is_manual_sale,
    manual_customer_name,
    manual_customer_email,
    manual_customer_phone,
    payment_terms,
    billing_address,
    shipping_address,
    invoice_notes,
    created_at,
    updated_at
  ) VALUES (
    p_order_id,
    p_user_id,
    p_company_id,
    p_items,
    p_subtotal,
    p_tax_rate,
    p_tax_amount,
    p_total_price,
    v_profit,
    'approved',
    TRUE,
    p_manual_customer_name,
    p_manual_customer_email,
    p_manual_customer_phone,
    p_payment_terms,
    p_billing_address,
    p_shipping_address,
    p_invoice_notes,
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object('order_id', p_order_id, 'profit', v_profit);
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_sale_order(uuid, uuid, uuid, jsonb, numeric, numeric, text, numeric, numeric, text, text, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_manual_sale_order(uuid, uuid, uuid, jsonb, numeric, numeric, text, numeric, numeric, text, text, text, text, text, text) TO authenticated;
