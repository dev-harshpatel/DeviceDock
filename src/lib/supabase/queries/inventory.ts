/**
 * Inventory queries
 * Functions for querying inventory data from Supabase
 */

import { InventoryItem } from "@/data/inventory";
import type { PaginatedResult } from "@/hooks/use-paginated-query";
import type { IdentifierFullLookup } from "@/types/inventory-identifiers";
import { supabase } from "../client/browser";
import { INVENTORY_SORT_ORDER } from "../../constants";
import { dbRowToInventoryItem } from "./mappers";
import type { FilterValues, InventorySortBy } from "@/components/common/FilterBar";

export type InventoryFilters = FilterValues;

// Columns safe for regular users / public views
export const INVENTORY_PUBLIC_FIELDS = [
  "id",
  "device_name",
  "brand",
  "grade",
  "storage",
  "quantity",
  "selling_price",
  "last_updated",
  "price_change",
  "is_active",
].join(", ");

// Columns required for admin views (includes cost/margin data)
export const INVENTORY_ADMIN_FIELDS = [
  "id",
  "device_name",
  "brand",
  "grade",
  "storage",
  "quantity",
  "price_per_unit",
  "purchase_price",
  "hst",
  "selling_price",
  "last_updated",
  "price_change",
  "is_active",
].join(", ");

// Helper applies filters to a Supabase query builder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyInventoryFilters(query: any, filters: InventoryFilters) {
  if (filters.search) {
    query = query.ilike("device_name", `%${filters.search}%`);
  }
  if (filters.brand !== "all") {
    query = query.eq("brand", filters.brand);
  }
  if (filters.grade !== "all") {
    query = query.eq("grade", filters.grade);
  }
  if (filters.storage !== "all") {
    query = query.eq("storage", filters.storage);
  }
  if (filters.priceRange !== "all") {
    switch (filters.priceRange) {
      case "under200":
        query = query.lt("selling_price", 200);
        break;
      case "200-400":
        query = query.gte("selling_price", 200).lte("selling_price", 400);
        break;
      case "400+":
        query = query.gte("selling_price", 400);
        break;
    }
  }
  if (filters.stockStatus !== "all") {
    switch (filters.stockStatus) {
      case "in-stock":
        query = query.gt("quantity", 0);
        break;
      case "low-stock":
        query = query.gte("quantity", 5).lte("quantity", 10);
        break;
      case "critical":
        query = query.gt("quantity", 0).lt("quantity", 5);
        break;
      case "out-of-stock":
        query = query.eq("quantity", 0);
        break;
    }
  }
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyInventorySort(query: any, sortBy: InventorySortBy) {
  switch (sortBy) {
    case "created_desc":
      return query.order("created_at", { ascending: false }).order("id", { ascending: false });
    case "purchase_desc":
      return query
        .order("purchase_price", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true });
    case "purchase_asc":
      return query
        .order("purchase_price", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });
    case "selling_stock_desc":
      return query
        .order("selling_stock_value", { ascending: false })
        .order("id", { ascending: true });
    case "selling_stock_asc":
      return query
        .order("selling_stock_value", { ascending: true })
        .order("id", { ascending: true });
    case "qty_desc":
      return query.order("quantity", { ascending: false }).order("id", { ascending: true });
    case "qty_asc":
      return query.order("quantity", { ascending: true }).order("id", { ascending: true });
    case "created_asc":
    default:
      return query.order("created_at", { ascending: true }).order("id", { ascending: true });
  }
}

export async function fetchPaginatedInventory(
  filters: InventoryFilters,
  range: { from: number; to: number },
  options?: { showInactive?: boolean; includeAdminFields?: boolean; companyId?: string },
): Promise<PaginatedResult<InventoryItem>> {
  const fields = options?.includeAdminFields ? INVENTORY_ADMIN_FIELDS : INVENTORY_PUBLIC_FIELDS;

  console.log("[fetchPaginatedInventory] companyId:", options?.companyId, "range:", range);

  let query = supabase.from("inventory").select(fields, { count: "exact" });

  if (options?.companyId) {
    // company_id column typing on generic client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("company_id", options.companyId);
  }

  if (!options?.showInactive) {
    query = query.eq("is_active", true);
  }

  query = applyInventoryFilters(query, filters);
  query = applyInventorySort(query, filters.sortBy ?? "created_asc");
  query = query.range(range.from, range.to);

  const { data, count, error } = await query;

  if (error) {
    console.error(
      "[fetchPaginatedInventory] Supabase error:",
      error.code,
      error.message,
      error.details,
      error.hint,
    );
    throw error;
  }

  console.log("[fetchPaginatedInventory] returned rows:", data?.length ?? 0, "total count:", count);
  return {
    data: (data || []).map(dbRowToInventoryItem),
    count: count || 0,
  };
}

export async function fetchFilterOptions(companyId?: string): Promise<{
  brands: string[];
  storageOptions: string[];
}> {
  let query = supabase.from("inventory").select("brand, storage");

  if (companyId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error || !data) return { brands: [], storageOptions: [] };

  const rows = (data || []) as Array<{
    brand: string | null;
    storage: string | null;
  }>;

  const brands = Array.from(new Set(rows.map((r) => r.brand)))
    .filter(Boolean)
    .sort() as string[];

  const storageOptions = Array.from(new Set(rows.map((r) => r.storage)))
    .filter(Boolean)
    .sort((a: string, b: string) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    }) as string[];

  return { brands, storageOptions };
}

export async function fetchAllFilteredInventory(
  filters: InventoryFilters,
  options?: { showInactive?: boolean; includeAdminFields?: boolean; companyId?: string },
): Promise<InventoryItem[]> {
  const fields = options?.includeAdminFields ? INVENTORY_ADMIN_FIELDS : INVENTORY_PUBLIC_FIELDS;

  let query = supabase.from("inventory").select(fields);

  if (options?.companyId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("company_id", options.companyId);
  }

  if (!options?.showInactive) {
    query = query.eq("is_active", true);
  }

  query = applyInventoryFilters(query, filters);
  query = applyInventorySort(query, filters.sortBy ?? "created_asc");

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(dbRowToInventoryItem);
}

/**
 * Fetch inventory items by their IDs
 */
export async function fetchInventoryByIds(
  itemIds: string[],
  companyId?: string,
): Promise<InventoryItem[]> {
  if (itemIds.length === 0) return [];

  let query = supabase
    .from("inventory")
    .select(INVENTORY_PUBLIC_FIELDS)
    .in("id", itemIds)
    .eq("is_active", true)
    .order("created_at", INVENTORY_SORT_ORDER.created_at)
    .order("id", INVENTORY_SORT_ORDER.id);

  if (companyId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(dbRowToInventoryItem);
}

/**
 * Fetches every inventory item for a company — no pagination, no filters.
 * Used by contexts and pages that need the full in-memory list
 * (reports, HST reconciliation, manual sale wizard, etc.)
 */
export async function fetchAllInventory(companyId: string): Promise<InventoryItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory") as any)
    .select(INVENTORY_ADMIN_FIELDS)
    .eq("company_id", companyId)
    .order("created_at", INVENTORY_SORT_ORDER.created_at)
    .order("id", INVENTORY_SORT_ORDER.id);

  if (error) throw error;
  return data ? data.map(dbRowToInventoryItem) : [];
}

// ── IMEI / Identifier list ────────────────────────────────────────────────

export interface IdentifierListItem {
  identifierId: string;
  imei: string | null;
  serialNumber: string | null;
  status: string;
  soldAt: string | null;
  color: string | null;
  damageNote: string | null;
  deviceName: string;
  brand: string;
  grade: string;
  storage: string;
}

export interface IdentifierFilters {
  search: string;
  grade: string;
  storage: string;
  status: string;
}

export const defaultIdentifierFilters: IdentifierFilters = {
  search: "",
  grade: "all",
  storage: "all",
  status: "all",
};

/**
 * Fetch a paginated list of inventory identifiers (IMEIs), joined with their
 * parent inventory item for device/grade/storage info.
 *
 * Filters on device name, grade, and storage are resolved in two steps:
 *  1. Find matching inventory_ids from the inventory table.
 *  2. Filter identifiers by those IDs (plus any status filter).
 *
 * This avoids relying on PostgREST embedded-resource filter syntax, which can
 * be fragile with aliased joins on loosely-typed clients.
 */
export async function fetchPaginatedIdentifiers(
  companyId: string,
  filters: IdentifierFilters,
  range: { from: number; to: number },
): Promise<PaginatedResult<IdentifierListItem>> {
  const hasInventoryFilters =
    filters.search.trim() || filters.grade !== "all" || filters.storage !== "all";

  // Step 1 — resolve inventory IDs when inventory-level filters are active
  let inventoryIds: string[] | null = null;
  if (hasInventoryFilters) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let invQ = (supabase.from("inventory") as any)
      .select("id")
      .eq("company_id", companyId)
      .eq("is_active", true);

    if (filters.search.trim()) {
      invQ = invQ.ilike("device_name", `%${filters.search.trim()}%`);
    }
    if (filters.grade !== "all") {
      invQ = invQ.eq("grade", filters.grade);
    }
    if (filters.storage !== "all") {
      invQ = invQ.eq("storage", filters.storage);
    }

    const { data: invData, error: invErr } = await invQ;
    if (invErr) throw invErr;

    inventoryIds = ((invData ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (inventoryIds.length === 0) return { data: [], count: 0 };
  }

  // Step 2 — query identifiers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from("inventory_identifiers") as any)
    .select("id, imei, serial_number, status, sold_at, color, damage_note, inventory_id", {
      count: "exact",
    })
    .eq("company_id", companyId);

  if (inventoryIds !== null) {
    q = q.in("inventory_id", inventoryIds);
  }
  if (filters.status !== "all") {
    q = q.eq("status", filters.status);
  }

  q = q.order("created_at", { ascending: false }).range(range.from, range.to);

  const { data: rows, count, error } = await q;
  if (error) throw error;

  const identifierRows = (rows ?? []) as Array<{
    id: string;
    imei: string | null;
    serial_number: string | null;
    status: string;
    sold_at: string | null;
    color: string | null;
    damage_note: string | null;
    inventory_id: string;
  }>;

  if (identifierRows.length === 0) return { data: [], count: count ?? 0 };

  // Step 3 — fetch inventory details for the unique inventory_ids in this page
  const uniqueInvIds = Array.from(new Set(identifierRows.map((r) => r.inventory_id)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invDetails, error: invDetailErr } = await (supabase.from("inventory") as any)
    .select("id, device_name, brand, grade, storage")
    .in("id", uniqueInvIds);

  if (invDetailErr) throw invDetailErr;

  const invMap = new Map<
    string,
    { device_name: string; brand: string; grade: string; storage: string }
  >();
  for (const inv of invDetails ?? []) {
    invMap.set(
      inv.id as string,
      inv as { device_name: string; brand: string; grade: string; storage: string },
    );
  }

  const data: IdentifierListItem[] = identifierRows.map((row) => {
    const inv = invMap.get(row.inventory_id);
    return {
      identifierId: row.id,
      imei: row.imei,
      serialNumber: row.serial_number,
      status: row.status ?? "in_stock",
      soldAt: row.sold_at,
      color: row.color,
      damageNote: row.damage_note,
      deviceName: inv?.device_name ?? "—",
      brand: inv?.brand ?? "—",
      grade: inv?.grade ?? "—",
      storage: inv?.storage ?? "—",
    };
  });

  return { data, count: count ?? 0 };
}

/**
 * Look up a device by exact IMEI across all statuses.
 */
export async function lookupIdentifierByImei(
  companyId: string,
  imei: string,
): Promise<IdentifierFullLookup | null> {
  const trimmed = imei.trim();
  if (!trimmed) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase.from("inventory_identifiers") as any)
    .select("id, inventory_id, imei, serial_number, status, sold_at, color, damage_note")
    .eq("company_id", companyId)
    .eq("imei", trimmed)
    .maybeSingle();

  if (error || !row) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invRow, error: invErr } = await (supabase.from("inventory") as any)
    .select(INVENTORY_ADMIN_FIELDS)
    .eq("id", row.inventory_id as string)
    .eq("company_id", companyId)
    .maybeSingle();

  if (invErr || !invRow) return null;

  // Prefer the per-unit color from the identifier row.
  // Fall back to the aggregate inventory_colors table as a display string.
  const identifierColor = (row.color as string | null) ?? null;

  let color: string | null = identifierColor;
  if (!color) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: colorRows, error: colorError } = await (supabase.from("inventory_colors") as any)
      .select("color")
      .eq("inventory_id", row.inventory_id as string)
      .order("color");

    color =
      colorError || !Array.isArray(colorRows)
        ? null
        : colorRows
            .map((colorRow: { color: string | null }) => colorRow.color?.trim() ?? "")
            .filter(Boolean)
            .join(", ") || null;
  }

  return {
    identifierId: row.id as string,
    imei: (row.imei as string | null) ?? null,
    serialNumber: (row.serial_number as string | null) ?? null,
    status: String(row.status ?? "in_stock"),
    soldAt: (row.sold_at as string | null) ?? null,
    color,
    damageNote: (row.damage_note as string | null) ?? null,
    item: dbRowToInventoryItem(invRow),
  };
}
