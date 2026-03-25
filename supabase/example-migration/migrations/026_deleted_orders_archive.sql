-- Migration 026: Deleted orders archive + delete RPC
--
-- Creates the deleted_orders table to archive orders before they are removed.
-- Creates (or replaces) the delete_order_and_restore_inventory RPC which:
--   1. Checks the caller is an owner or manager in the order's company
--   2. Archives the full order row to deleted_orders
--   3. Restores inventory qty AND recalculates purchase_price proportionally
--   4. Deletes the order from the active orders table

-- ─── Archive table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deleted_orders (
  id                     UUID          NOT NULL PRIMARY KEY,
  company_id             UUID          REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id                UUID          NOT NULL,
  items                  JSONB         NOT NULL,
  subtotal               NUMERIC(10,2),
  tax_rate               NUMERIC(8,4),
  tax_amount             NUMERIC(10,2),
  total_price            NUMERIC(10,2) NOT NULL,
  status                 TEXT          NOT NULL,
  created_at             TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ,
  rejection_reason       TEXT,
  rejection_comment      TEXT,
  invoice_number         TEXT,
  invoice_date           TEXT,
  po_number              TEXT,
  payment_terms          TEXT,
  due_date               TEXT,
  hst_number             TEXT,
  invoice_notes          TEXT,
  invoice_terms          TEXT,
  invoice_confirmed      BOOLEAN       DEFAULT FALSE,
  invoice_confirmed_at   TIMESTAMPTZ,
  discount_amount        NUMERIC(10,2) DEFAULT 0,
  discount_type          TEXT,
  shipping_amount        NUMERIC(10,2) DEFAULT 0,
  shipping_address       TEXT,
  billing_address        TEXT,
  imei_numbers           JSONB,
  is_manual_sale         BOOLEAN       DEFAULT FALSE,
  manual_customer_name   TEXT,
  manual_customer_email  TEXT,
  manual_customer_phone  TEXT,
  -- Archive metadata
  deleted_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deleted_orders_company_id
  ON public.deleted_orders (company_id);

CREATE INDEX IF NOT EXISTS idx_deleted_orders_deleted_at
  ON public.deleted_orders (deleted_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.deleted_orders ENABLE ROW LEVEL SECURITY;

-- Active company members with owner / manager role can view deleted orders
DROP POLICY IF EXISTS "company_managers_view_deleted_orders" ON public.deleted_orders;
CREATE POLICY "company_managers_view_deleted_orders"
  ON public.deleted_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = deleted_orders.company_id
        AND cu.role       IN ('owner', 'manager')
        AND cu.status     = 'active'
    )
  );

-- ─── RPC ──────────────────────────────────────────────────────────────────────

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
  -- Verify the caller is an owner or manager in the order's company
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id    = auth.uid()
      AND cu.company_id = v_order.company_id
      AND cu.role       IN ('owner', 'manager')
      AND cu.status     = 'active'
  ) THEN
    RAISE EXCEPTION 'Only company owners or managers can delete orders';
  END IF;

  -- Archive to deleted_orders before removing
  INSERT INTO deleted_orders (
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

  -- Only restore inventory for approved / completed orders and manual sales
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
      -- Recalculate purchase_price proportionally so cost-per-unit stays consistent.
      -- cost_per_unit = purchase_price / quantity  (when quantity > 0)
      -- cost_per_unit = price_per_unit / (1 + hst%) (fallback when quantity = 0)
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

REVOKE ALL ON FUNCTION public.delete_order_and_restore_inventory(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_order_and_restore_inventory(UUID) TO authenticated;
