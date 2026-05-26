/**
 * Orders queries
 * Functions for querying order data from Supabase
 */

import type { PaginatedResult } from "@/hooks/common/use-paginated-query";
import { Order } from "@/types/order";
import { supabase } from "../client/browser";
import { dbRowToOrder } from "./mappers";

export interface DeletedOrder extends Order {
  deletedAt: string;
  /** Preserved from deleted_orders archive — nullable after migration 048 made it optional. */
  status?: string | null;
}

const DELETED_ORDER_FIELDS = [
  "id",
  "company_id",
  "user_id",
  "items",
  "subtotal",
  "tax_rate",
  "tax_amount",
  "total_price",
  "status",
  "created_at",
  "updated_at",
  "rejection_reason",
  "rejection_comment",
  "invoice_number",
  "is_manual_sale",
  "manual_customer_name",
  "manual_customer_email",
  "manual_customer_phone",
  "discount_amount",
  "discount_type",
  "shipping_amount",
  "deleted_at",
].join(", ");

export interface OrdersFilters {
  search: string;
}

// Columns required to build an Order via dbRowToOrder
export const ORDER_FIELDS = [
  "id",
  "user_id",
  "items",
  "subtotal",
  "tax_rate",
  "tax_amount",
  "total_price",
  "created_at",
  "updated_at",
  "invoice_number",
  "invoice_date",
  "po_number",
  "payment_terms",
  "due_date",
  "hst_number",
  "invoice_notes",
  "invoice_terms",
  "invoice_confirmed",
  "invoice_confirmed_at",
  "discount_amount",
  "discount_type",
  "shipping_amount",
  "shipping_address",
  "billing_address",
  "imei_numbers",
  "is_manual_sale",
  "manual_customer_name",
  "manual_customer_email",
  "manual_customer_phone",
].join(", ");

// Lightweight field set for paginated list views — omits large/detail-only columns.
// Invoice fields, addresses, and IMEI data are only needed when a single order modal opens.
const ORDER_SUMMARY_FIELDS = [
  "id",
  "user_id",
  "items",
  "subtotal",
  "tax_rate",
  "tax_amount",
  "total_price",
  "created_at",
  "updated_at",
  "invoice_number",
  "discount_amount",
  "discount_type",
  "shipping_amount",
  "is_manual_sale",
  "manual_customer_name",
].join(", ");

export async function fetchPaginatedOrders(
  filters: OrdersFilters,
  range: { from: number; to: number },
  companyId?: string,
): Promise<PaginatedResult<Order>> {
  const hasSearch = filters.search.trim().length > 0;

  let query = supabase
    .from("orders")
    .select(ORDER_SUMMARY_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (companyId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("company_id", companyId);
  }

  if (hasSearch) {
    const q = filters.search.trim().toLowerCase();
    query = query.ilike("id", `%${q}%`);
  }

  query = query.range(range.from, range.to);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    data: (data || []).map(dbRowToOrder),
    count: count || 0,
  };
}

/** Fetches the full Order detail for a single ID — used when a modal opens. */
export async function fetchOrderById(id: string, companyId?: string): Promise<Order> {
  let query = supabase.from("orders").select(ORDER_FIELDS).eq("id", id);

  if (companyId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("company_id", companyId);
  }

  const { data, error } = await query.single();
  if (error) throw error;
  return dbRowToOrder(data);
}

export async function fetchPaginatedDeletedOrders(
  range: { from: number; to: number },
  companyId?: string,
): Promise<PaginatedResult<DeletedOrder>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("deleted_orders") as any)
    .select(DELETED_ORDER_FIELDS, { count: "exact" })
    .order("deleted_at", { ascending: false });

  if (companyId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("company_id", companyId);
  }

  query = query.range(range.from, range.to);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    data: (data || []).map(
      (row: Record<string, unknown>): DeletedOrder => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...dbRowToOrder(row as any),
        deletedAt: row.deleted_at as string,
        status: (row.status as string | null) ?? null,
      }),
    ),
    count: count || 0,
  };
}

/**
 * Fetches every order for a company — no pagination, no filters.
 * Used by contexts and pages that need the full in-memory list
 * (dashboard activity feed, reports, HST reconciliation, etc.)
 */
export async function fetchAllOrders(companyId: string): Promise<Order[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("orders") as any)
    .select(ORDER_FIELDS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ? data.map(dbRowToOrder) : [];
}

export async function fetchPaginatedUserOrders(
  userId: string,
  range: { from: number; to: number },
  companyId?: string,
): Promise<PaginatedResult<Order>> {
  let query = supabase
    .from("orders")
    .select(ORDER_FIELDS, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (companyId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("company_id", companyId);
  }

  query = query.range(range.from, range.to);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    data: (data || []).map(dbRowToOrder),
    count: count || 0,
  };
}

/**
 * Inserts a new manual sale order in the database.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertOrder(newOrder: any): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("orders") as any)
    .insert([newOrder])
    .select()
    .single();

  if (error) {
    console.error("[insertOrder] failed:", error);
    throw error;
  }
  return data;
}

/**
 * Triggers the update_manual_sale_order RPC function.
 */
export async function updateManualSaleOrderRpc(
  orderId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any,
  taxRate: number | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("update_manual_sale_order", {
    p_order_id: orderId,
    p_items: items,
    p_tax_rate: taxRate,
  });

  if (error) {
    console.error("[updateManualSaleOrderRpc] failed:", error);
    throw error;
  }
}

/**
 * Updates columns for a single order in the database.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateOrderInDb(orderId: string, updateData: any): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("orders") as any).update(updateData).eq("id", orderId);

  if (error) {
    console.error("[updateOrderInDb] failed:", error);
    throw error;
  }
}

/**
 * Invokes the delete_order_and_restore_inventory RPC function.
 */
export async function deleteOrderRpc(orderId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("delete_order_and_restore_inventory", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("[deleteOrderRpc] failed:", error);
    throw error;
  }
  return !!data;
}

export async function checkIdentifierOrderReferencesQuery(
  companyId: string,
  identifierId: string,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase.from("orders") as any)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .filter("items", "cs", JSON.stringify([{ inventoryIdentifierId: identifierId }]));

  if (error) {
    throw error;
  }
  return count || 0;
}
