/**
 * Orders queries
 * Functions for querying order data from Supabase
 */

import type { PaginatedResult } from "@/hooks/use-paginated-query";
import { Order, OrderStatus } from "@/types/order";
import { supabase } from "../client/browser";
import { dbRowToOrder } from "./mappers";

export interface DeletedOrder extends Order {
  deletedAt: string;
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
  status: OrderStatus | "all";
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
  "status",
  "created_at",
  "updated_at",
  "rejection_reason",
  "rejection_comment",
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
  "profit",
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
  "status",
  "created_at",
  "updated_at",
  "rejection_reason",
  "rejection_comment",
  "invoice_number",
  "discount_amount",
  "discount_type",
  "shipping_amount",
  "is_manual_sale",
  "manual_customer_name",
  "profit",
].join(", ");

export async function fetchPaginatedOrders(
  filters: OrdersFilters,
  range: { from: number; to: number },
  companyId?: string,
): Promise<PaginatedResult<Order>> {
  const hasSearch = filters.search.trim().length > 0;

  if (hasSearch) {
    const q = filters.search.trim().toLowerCase();

    let query = supabase
      .from("orders")
      .select(ORDER_SUMMARY_FIELDS, { count: "exact" })
      .order("created_at", { ascending: false });

    if (companyId) {
      query = (query as any).eq("company_id", companyId);
    }

    if (filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    query = query.or(`id.ilike.%${q}%,status.ilike.%${q}%`);
    query = query.range(range.from, range.to);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      data: (data || []).map(dbRowToOrder),
      count: count || 0,
    };
  }

  // No search - simple paginated query
  let query = supabase
    .from("orders")
    .select(ORDER_SUMMARY_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (companyId) {
    query = (query as any).eq("company_id", companyId);
  }

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
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
  let query = (supabase as any)
    .from("deleted_orders")
    .select(DELETED_ORDER_FIELDS, { count: "exact" })
    .order("deleted_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  query = query.range(range.from, range.to);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    data: (data || []).map(
      (row: any): DeletedOrder => ({
        ...dbRowToOrder(row),
        deletedAt: row.deleted_at,
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
  statusFilter: OrderStatus | "all",
  range: { from: number; to: number },
  companyId?: string,
): Promise<PaginatedResult<Order>> {
  let query = supabase
    .from("orders")
    .select(ORDER_FIELDS, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (companyId) {
    query = (query as any).eq("company_id", companyId);
  }

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  query = query.range(range.from, range.to);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    data: (data || []).map(dbRowToOrder),
    count: count || 0,
  };
}
