-- Revert the AND is_active = true filter added in migration 044.
-- That filter unexpectedly excluded newly inserted rows on the local dev database,
-- causing the dashboard stats to not reflect newly added inventory.
-- The deployed version (without 044) works correctly without this filter.
-- VOLATILE keyword from 045 is preserved as it is the correct volatility for an aggregate.

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
  WHERE company_id = p_company_id;
$$;

GRANT EXECUTE ON FUNCTION get_inventory_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_stats(UUID) TO anon;
