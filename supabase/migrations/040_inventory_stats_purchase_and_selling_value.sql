-- Dashboard: separate inventory aggregates — cost (sum of purchase_price) vs retail (sum of qty × selling_price).

CREATE OR REPLACE FUNCTION get_inventory_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_devices',   COUNT(*),
    'total_units',     COALESCE(SUM(quantity), 0),
    'total_value',     COALESCE(SUM(quantity * COALESCE(selling_price, 0)), 0),
    'total_purchase_value', COALESCE(SUM(COALESCE(purchase_price, 0)), 0),
    'low_stock_items', COUNT(*) FILTER (WHERE quantity <= 10)
  )
  FROM inventory
  WHERE company_id = p_company_id;
$$;

GRANT EXECUTE ON FUNCTION get_inventory_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_stats(UUID) TO anon;
