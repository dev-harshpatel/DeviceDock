-- Migration: 048_remove_order_status.sql
-- Remove order status from the POS system.
-- Every order is a manual admin sale recorded immediately — no pending/approve/reject workflow.
-- Drop status + rejection columns from orders; simplify all RPCs that checked status.

-- ─── 1. Drop status-related columns from orders ──────────────────────────────

ALTER TABLE public.orders DROP COLUMN IF EXISTS status;
ALTER TABLE public.orders DROP COLUMN IF EXISTS rejection_reason;
ALTER TABLE public.orders DROP COLUMN IF EXISTS rejection_comment;

-- Drop the index that was on the status column
DROP INDEX IF EXISTS public.idx_orders_status;

-- ─── 2. Keep deleted_orders as a historical archive ───────────────────────────
-- Make the status column nullable so the archive INSERT still works when called
-- from existing code paths, and existing rows are preserved.
ALTER TABLE public.deleted_orders ALTER COLUMN status DROP NOT NULL;

-- ─── 3. Update delete_order_and_restore_inventory ────────────────────────────
-- Removed: status check for whether to restore inventory (always restore now).
-- Removed: rejection_reason + rejection_comment from archive INSERT.

CREATE OR REPLACE FUNCTION public.delete_order_and_restore_inventory(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
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
    created_at, updated_at,
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
    v_order.created_at, v_order.updated_at,
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

  -- Always restore inventory on delete (all orders are manual admin sales)
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

  WITH identifier_ids AS (
    SELECT DISTINCT NULLIF(trim(value->>'inventoryIdentifierId'), '')::uuid AS id
    FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb)) AS t(value)
    WHERE NULLIF(trim(value->>'inventoryIdentifierId'), '') IS NOT NULL
  )
  UPDATE public.inventory_identifiers ii
  SET
    status     = 'in_stock',
    sold_at    = NULL,
    updated_at = NOW()
  FROM identifier_ids x
  WHERE ii.id         = x.id
    AND ii.company_id = v_order.company_id
    AND ii.status     = 'sold';

  DELETE FROM public.orders WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_order_and_restore_inventory(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_order_and_restore_inventory(UUID) TO authenticated;

-- ─── 4. Update update_manual_sale_order ──────────────────────────────────────
-- Removed: status IN ('approved','completed') guard — all orders are editable by admins.

CREATE OR REPLACE FUNCTION public.update_manual_sale_order(
  p_order_id uuid,
  p_items    jsonb,
  p_tax_rate numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order       RECORD;
  v_company_id  uuid;
  v_subtotal    numeric(10, 2);
  v_profit      numeric(10, 2);
  v_tax_rate    numeric(8, 4);
  v_tax_amount  numeric(10, 2);
  v_total       numeric(10, 2);
  v_line        record;
  v_elem        jsonb;
  v_item_id     uuid;
  v_qty         integer;
  v_ident       text;
  v_inv_qty     integer;
  v_inv_pp      numeric;
  v_new_inv_qty integer;
  v_new_pp      numeric;
  v_cost_unit   numeric;
  v_snap_qty    numeric;
  v_pp_snap     numeric;
  v_hst         numeric;
  v_ppu         numeric;
  v_sell        numeric;
  v_line_rev    numeric;
  v_line_cost   numeric;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_company_id := v_order.company_id;

  IF NOT COALESCE(v_order.is_manual_sale, false) THEN
    RAISE EXCEPTION 'Not a manual sale order';
  END IF;

  IF COALESCE(v_order.invoice_confirmed, false) = true THEN
    RAISE EXCEPTION 'Invoice is confirmed; order cannot be edited';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id    = auth.uid()
      AND cu.company_id = v_company_id
      AND cu.role       IN ('owner', 'manager', 'inventory_admin')
      AND cu.status     = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items must be a non-empty array';
  END IF;

  -- 1) Restore colour stock from prior order_color_assignments, then remove rows
  FOR v_line IN
    SELECT oca.inventory_id, oca.color, oca.quantity AS q
    FROM public.order_color_assignments oca
    WHERE oca.order_id = p_order_id
  LOOP
    UPDATE public.inventory_colors ic
    SET quantity   = ic.quantity + v_line.q,
        updated_at = now()
    WHERE ic.inventory_id = v_line.inventory_id
      AND ic.color        = v_line.color;
  END LOOP;

  DELETE FROM public.order_color_assignments WHERE order_id = p_order_id;

  -- 2) Reverse old sale: inventory qty + purchase_price + identifiers
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
  WHERE i.id = p.item_id AND i.company_id = v_company_id;

  WITH identifier_ids AS (
    SELECT DISTINCT NULLIF(trim(value->>'inventoryIdentifierId'), '')::uuid AS id
    FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb)) AS t(value)
    WHERE NULLIF(trim(value->>'inventoryIdentifierId'), '') IS NOT NULL
  )
  UPDATE public.inventory_identifiers ii
  SET status = 'in_stock', sold_at = NULL, updated_at = NOW()
  FROM identifier_ids x
  WHERE ii.id = x.id AND ii.company_id = v_company_id AND ii.status = 'sold';

  -- 3) Apply new lines
  FOR v_elem IN SELECT value AS elem FROM jsonb_array_elements(p_items) AS t(value) LOOP
    v_item_id := NULLIF(trim(v_elem->'item'->>'id'), '')::uuid;
    v_qty     := GREATEST(COALESCE((v_elem->>'quantity')::integer, 0), 0);
    v_ident   := NULLIF(trim(v_elem->>'inventoryIdentifierId'), '');

    IF v_item_id IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid line: missing item id or quantity';
    END IF;

    SELECT i.quantity, i.purchase_price INTO v_inv_qty, v_inv_pp
    FROM public.inventory i
    WHERE i.id = v_item_id AND i.company_id = v_company_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found or wrong company: %', v_item_id;
    END IF;

    IF v_inv_qty < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_item_id;
    END IF;

    IF v_ident IS NOT NULL THEN
      IF v_qty <> 1 THEN RAISE EXCEPTION 'Identifier lines must have quantity 1'; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.inventory_identifiers ii
        WHERE ii.id = v_ident::uuid AND ii.company_id = v_company_id
          AND ii.inventory_id = v_item_id AND ii.status IN ('in_stock', 'reserved')
      ) THEN
        RAISE EXCEPTION 'IMEI/serial unit not available: %', v_ident;
      END IF;
    END IF;

    v_new_inv_qty := v_inv_qty - v_qty;
    IF v_inv_pp IS NOT NULL AND v_inv_qty > 0 THEN
      v_new_pp := ROUND((v_inv_pp / v_inv_qty::numeric) * v_new_inv_qty::numeric, 2);
    ELSE
      v_new_pp := v_inv_pp;
    END IF;

    UPDATE public.inventory i
    SET quantity = v_new_inv_qty, purchase_price = v_new_pp,
        last_updated = 'Just now', updated_at = NOW()
    WHERE i.id = v_item_id AND i.company_id = v_company_id;

    IF v_ident IS NOT NULL THEN
      UPDATE public.inventory_identifiers ii
      SET status = 'sold', sold_at = now(), updated_at = now()
      WHERE ii.id = v_ident::uuid AND ii.company_id = v_company_id
        AND ii.status IN ('in_stock', 'reserved');
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to mark identifier sold: %', v_ident;
      END IF;
    END IF;
  END LOOP;

  -- 4) Subtotal
  SELECT COALESCE(SUM(
    COALESCE(
      NULLIF(trim(elem->'item'->>'sellingPrice'), '')::numeric,
      NULLIF(trim(elem->'item'->>'selling_price'), '')::numeric,
      NULLIF(trim(elem->'item'->>'pricePerUnit'), '')::numeric,
      NULLIF(trim(elem->'item'->>'price_per_unit'), '')::numeric,
      0::numeric
    ) * GREATEST(COALESCE((elem->>'quantity')::integer, 0), 0)::numeric
  ), 0::numeric)
  INTO v_subtotal
  FROM jsonb_array_elements(p_items) AS e(elem);

  -- 5) Profit
  v_profit := 0;
  FOR v_elem IN SELECT value AS elem FROM jsonb_array_elements(p_items) AS t(value) LOOP
    v_sell := COALESCE(
      NULLIF(trim(v_elem->'item'->>'sellingPrice'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'selling_price'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'pricePerUnit'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'price_per_unit'), '')::numeric,
      0::numeric
    );
    v_qty      := GREATEST(COALESCE((v_elem->>'quantity')::integer, 0), 0);
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

  v_tax_rate := COALESCE(p_tax_rate, v_order.tax_rate);
  IF v_tax_rate IS NOT NULL THEN
    v_tax_amount := ROUND(v_subtotal * v_tax_rate, 2);
    v_total      := v_subtotal + COALESCE(v_tax_amount, 0);
  ELSE
    v_tax_amount := NULL;
    v_total      := v_subtotal;
  END IF;

  UPDATE public.orders o
  SET items      = p_items,
      subtotal   = v_subtotal,
      tax_rate   = v_tax_rate,
      tax_amount = v_tax_amount,
      total_price = v_total,
      profit      = v_profit,
      updated_at  = NOW()
  WHERE o.id = p_order_id;

  RETURN jsonb_build_object(
    'subtotal',    v_subtotal,
    'tax_rate',    v_tax_rate,
    'tax_amount',  v_tax_amount,
    'total_price', v_total,
    'profit',      v_profit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_manual_sale_order(uuid, jsonb, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_manual_sale_order(uuid, jsonb, numeric) TO authenticated;

-- ─── 5. Update create_manual_sale_order (from migration 047) ─────────────────
-- Removed: status field from INSERT (column no longer exists).

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
  IF NOT EXISTS (
    SELECT 1 FROM public.company_users cu
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

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_item_id := NULLIF(trim(v_elem->'item'->>'id'), '')::uuid;
    v_qty     := GREATEST(COALESCE((v_elem->>'quantity')::integer, 0), 0);
    v_ident   := NULLIF(trim(v_elem->>'inventoryIdentifierId'), '');

    IF v_item_id IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid line: missing item id or quantity';
    END IF;

    SELECT i.quantity, i.purchase_price INTO v_inv_qty, v_inv_pp
    FROM public.inventory i
    WHERE i.id = v_item_id AND i.company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found: %', v_item_id; END IF;
    IF v_inv_qty < v_qty THEN RAISE EXCEPTION 'Insufficient stock for item %', v_item_id; END IF;

    IF v_ident IS NOT NULL THEN
      IF v_qty <> 1 THEN RAISE EXCEPTION 'Identifier lines must have quantity 1'; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.inventory_identifiers ii
        WHERE ii.id = v_ident::uuid AND ii.company_id = p_company_id
          AND ii.inventory_id = v_item_id AND ii.status IN ('in_stock', 'reserved')
      ) THEN
        RAISE EXCEPTION 'IMEI/serial unit not available: %', v_ident;
      END IF;
    END IF;

    v_new_qty := v_inv_qty - v_qty;
    IF v_inv_pp IS NOT NULL AND v_inv_qty > 0 THEN
      v_new_pp := ROUND((v_inv_pp / v_inv_qty::numeric) * v_new_qty::numeric, 2);
    ELSE
      v_new_pp := v_inv_pp;
    END IF;

    UPDATE public.inventory i
    SET quantity = v_new_qty, purchase_price = v_new_pp,
        last_updated = 'Just now', updated_at = NOW()
    WHERE i.id = v_item_id AND i.company_id = p_company_id;

    IF v_ident IS NOT NULL THEN
      UPDATE public.inventory_identifiers ii
      SET status = 'sold', sold_at = NOW(), updated_at = NOW()
      WHERE ii.id = v_ident::uuid AND ii.company_id = p_company_id
        AND ii.status IN ('in_stock', 'reserved');
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to mark identifier sold: %', v_ident;
      END IF;
    END IF;
  END LOOP;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_sell := COALESCE(
      NULLIF(trim(v_elem->'item'->>'sellingPrice'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'selling_price'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'pricePerUnit'), '')::numeric,
      NULLIF(trim(v_elem->'item'->>'price_per_unit'), '')::numeric,
      0::numeric
    );
    v_qty      := GREATEST(COALESCE((v_elem->>'quantity')::integer, 0), 0);
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

  INSERT INTO public.orders (
    id, user_id, company_id, items,
    subtotal, tax_rate, tax_amount, total_price, profit,
    is_manual_sale, manual_customer_name, manual_customer_email, manual_customer_phone,
    payment_terms, billing_address, shipping_address, invoice_notes,
    created_at, updated_at
  ) VALUES (
    p_order_id, p_user_id, p_company_id, p_items,
    p_subtotal, p_tax_rate, p_tax_amount, p_total_price, v_profit,
    TRUE, p_manual_customer_name, p_manual_customer_email, p_manual_customer_phone,
    p_payment_terms, p_billing_address, p_shipping_address, p_invoice_notes,
    NOW(), NOW()
  );

  RETURN jsonb_build_object('order_id', p_order_id, 'profit', v_profit);
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_sale_order(uuid, uuid, uuid, jsonb, numeric, numeric, text, numeric, numeric, text, text, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_manual_sale_order(uuid, uuid, uuid, jsonb, numeric, numeric, text, numeric, numeric, text, text, text, text, text, text) TO authenticated;

-- ─── 6. Simplify get_order_stats RPC ─────────────────────────────────────────
-- Removed: pending_orders and completed_orders breakdown (no status concept).
-- Kept: total_orders and total_revenue.

CREATE OR REPLACE FUNCTION public.get_order_stats(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_orders',  COUNT(*),
    'total_revenue', COALESCE(SUM(total_price), 0)
  )
  INTO v_result
  FROM public.orders
  WHERE company_id = p_company_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_stats(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_order_stats(uuid) TO authenticated;
