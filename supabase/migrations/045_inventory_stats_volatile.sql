-- Change get_inventory_stats from STABLE to VOLATILE.
-- STABLE allows Postgres to cache the result within a transaction, which can
-- cause the dashboard to show stale totals immediately after a bulk insert that
-- runs in the same transaction context. VOLATILE forces a fresh table scan on
-- every call, guaranteeing up-to-date aggregates.

CREATE OR REPLACE FUNCTION get_inventory_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE SQL
VOLATILE
AS $$
  SELECT jsonb_build_object(
    'total_devices',        COUNT(*),
    'total_units',          COALESCE(SUM(quantity), 0),
    'total_value',          COALESCE(SUM(quantity * COALESCE(selling_price, 0)), 0),
    'total_purchase_value', COALESCE(SUM(COALESCE(purchase_price, 0)), 0),
    'low_stock_items',      COUNT(*) FILTER (WHERE quantity <= 10)
  )
  FROM inventory
  WHERE company_id = p_company_id
    AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_inventory_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_stats(UUID) TO anon;
