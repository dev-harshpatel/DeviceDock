-- Replace 6 sequential client-side queries with 2 server-side aggregates.
-- Dashboard previously: 2 queries for inventory stats + 4 queries for order stats.
-- After: 1 RPC per stat group, aggregation done in Postgres.

-- ---------------------------------------------------------------------------
-- Inventory stats
-- Returns: total_devices, total_units, total_value, low_stock_items
-- Matches the JS aggregation in the old fetchInventoryStats():
--   low_stock_items = quantity <= 10 (same as the old .lte("quantity", 10) filter)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_inventory_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_devices',   COUNT(*),
    'total_units',     COALESCE(SUM(quantity), 0),
    'total_value',     COALESCE(SUM(quantity * selling_price), 0),
    'low_stock_items', COUNT(*) FILTER (WHERE quantity <= 10)
  )
  FROM inventory
  WHERE company_id = p_company_id;
$$;

GRANT EXECUTE ON FUNCTION get_inventory_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_stats(UUID) TO anon;

-- ---------------------------------------------------------------------------
-- Order stats
-- Returns: total_orders, pending_orders, completed_orders, total_revenue
-- Revenue logic matches old code: SUM(total_price) WHERE status IN ('approved','completed')
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_order_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_orders',     COUNT(*),
    'pending_orders',   COUNT(*) FILTER (WHERE status = 'pending'),
    'completed_orders', COUNT(*) FILTER (WHERE status = 'completed'),
    'total_revenue',    COALESCE(
                          SUM(total_price) FILTER (WHERE status IN ('approved', 'completed')),
                          0
                        )
  )
  FROM orders
  WHERE company_id = p_company_id;
$$;

GRANT EXECUTE ON FUNCTION get_order_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_stats(UUID) TO anon;
