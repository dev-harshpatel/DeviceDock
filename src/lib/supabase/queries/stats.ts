/**
 * Aggregate statistics queries
 * Performance-optimized queries for dashboard/reports
 */

import { supabase } from "../client/browser";

export interface InventoryStats {
  totalDevices: number;
  totalUnits: number;
  totalValue: number;
  lowStockItems: number;
}

/**
 * Fetch aggregate inventory statistics
 */
export async function fetchInventoryStats(companyId?: string): Promise<InventoryStats> {
  console.log("[fetchInventoryStats] companyId:", companyId);

  let countQuery = supabase
    .from("inventory")
    .select("id, quantity, selling_price", { count: "exact", head: false });

  if (companyId) {
    countQuery = (countQuery as any).eq("company_id", companyId);
  }

  const { data: countData, error: countError } = await countQuery;
  if (countError) {
    console.error(
      "[fetchInventoryStats] error:",
      countError.code,
      countError.message,
      countError.details,
      countError.hint,
    );
    throw countError;
  }
  console.log("[fetchInventoryStats] rows returned:", countData?.length ?? 0);

  const totalDevices = countData?.length || 0;

  const totalUnits = (
    (countData || []) as Array<{
      quantity: number | null;
      selling_price: number | null;
    }>
  ).reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  const totalValue = (
    (countData || []) as Array<{
      quantity: number | null;
      selling_price: number | null;
    }>
  ).reduce((sum, row) => {
    const quantity = Number(row.quantity) || 0;
    const sellingPrice = Number(row.selling_price) || 0;
    return sum + quantity * sellingPrice;
  }, 0);

  let lowStockQuery = supabase
    .from("inventory")
    .select("id", { count: "exact", head: false })
    .lte("quantity", 10);

  if (companyId) {
    lowStockQuery = (lowStockQuery as any).eq("company_id", companyId);
  }

  const { data: lowStockData, error: lowStockError } = await lowStockQuery;
  if (lowStockError) throw lowStockError;

  const lowStockItems = lowStockData?.length || 0;

  return {
    totalDevices,
    totalUnits,
    totalValue,
    lowStockItems,
  };
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  completedOrders: number;
}

/**
 * Fetch aggregate order statistics
 */
export async function fetchOrderStats(companyId?: string): Promise<OrderStats> {
  let totalQuery = supabase.from("orders").select("id", { count: "exact", head: true });

  if (companyId) {
    totalQuery = (totalQuery as any).eq("company_id", companyId);
  }

  const { count: totalOrders, error: totalError } = await totalQuery;
  if (totalError) throw totalError;

  let pendingQuery = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (companyId) {
    pendingQuery = (pendingQuery as any).eq("company_id", companyId);
  }

  const { count: pendingOrders, error: pendingError } = await pendingQuery;
  if (pendingError) throw pendingError;

  let completedQuery = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  if (companyId) {
    completedQuery = (completedQuery as any).eq("company_id", companyId);
  }

  const { count: completedOrders, error: completedError } = await completedQuery;
  if (completedError) throw completedError;

  let revenueQuery = supabase
    .from("orders")
    .select("total_price")
    .in("status", ["approved", "completed"]);

  if (companyId) {
    revenueQuery = (revenueQuery as any).eq("company_id", companyId);
  }

  const { data: revenueData, error: revenueError } = await revenueQuery;
  if (revenueError) throw revenueError;

  const totalRevenue = ((revenueData || []) as Array<{ total_price: number | null }>).reduce(
    (sum, row) => sum + (Number(row.total_price) || 0),
    0,
  );

  return {
    totalOrders: totalOrders || 0,
    pendingOrders: pendingOrders || 0,
    totalRevenue,
    completedOrders: completedOrders || 0,
  };
}
