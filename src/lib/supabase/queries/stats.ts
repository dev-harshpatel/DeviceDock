/**
 * Aggregate statistics queries
 * Each stat group is a single RPC call that aggregates in Postgres,
 * replacing the previous pattern of 2–4 sequential client-side queries.
 */

import { supabase } from "../client/browser";

export interface InventoryStats {
  totalDevices: number;
  totalUnits: number;
  /** Sum of `purchase_price` (tax-exclusive batch cost on hand). */
  totalPurchaseValue: number;
  /** Sum of `quantity × selling_price` (retail value of on-hand stock). */
  totalSellingValue: number;
  lowStockItems: number;
}

/** Raw shape returned by the get_inventory_stats RPC */
interface InventoryStatsRow {
  total_devices: number;
  total_units: number;
  total_value: number;
  total_purchase_value?: number;
  low_stock_items: number;
}

/**
 * Fetch aggregate inventory statistics via a single Postgres RPC.
 * Previously: 2 sequential queries + JS aggregation.
 * Now: 1 query, aggregation done server-side.
 */
export async function fetchInventoryStats(companyId?: string): Promise<InventoryStats> {
  if (!companyId) {
    return {
      totalDevices: 0,
      totalUnits: 0,
      totalPurchaseValue: 0,
      totalSellingValue: 0,
      lowStockItems: 0,
    };
  }

  // DB types aren't regenerated yet for these new functions — cast via any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_inventory_stats", {
    p_company_id: companyId,
  });

  if (error) throw error;

  const row = (data ?? {}) as InventoryStatsRow;
  return {
    totalDevices: Number(row.total_devices ?? 0),
    totalUnits: Number(row.total_units ?? 0),
    totalPurchaseValue: Number(row.total_purchase_value ?? 0),
    totalSellingValue: Number(row.total_value ?? 0),
    lowStockItems: Number(row.low_stock_items ?? 0),
  };
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  completedOrders: number;
}

/** Raw shape returned by the get_order_stats RPC */
interface OrderStatsRow {
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_revenue: number;
}

/**
 * Fetch aggregate order statistics via a single Postgres RPC.
 * Previously: 4 sequential queries (count all, count pending, count completed, sum revenue).
 * Now: 1 query, all aggregation done server-side.
 */
export async function fetchOrderStats(companyId?: string): Promise<OrderStats> {
  if (!companyId) {
    return { totalOrders: 0, pendingOrders: 0, totalRevenue: 0, completedOrders: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_order_stats", {
    p_company_id: companyId,
  });

  if (error) throw error;

  const row = (data ?? {}) as OrderStatsRow;
  return {
    totalOrders: Number(row.total_orders ?? 0),
    pendingOrders: Number(row.pending_orders ?? 0),
    completedOrders: Number(row.completed_orders ?? 0),
    totalRevenue: Number(row.total_revenue ?? 0),
  };
}
