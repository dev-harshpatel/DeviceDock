/**
 * Inventory queries
 * Functions for querying inventory data from Supabase
 */

import { InventoryItem } from "@/data/inventory";
import type { PaginatedResult } from "@/hooks/common/use-paginated-query";
import type { IdentifierFullLookup, IdentifierSaleLookup } from "@/types/inventory-identifiers";
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
  sellingPrice: number | null;
  purchasePrice: number | null;
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

  // Step 2 — query identifiers with inventory fields joined in a single round-trip.
  // Filtering on embedded-resource fields (e.g. inventory.grade) is intentionally
  // avoided here (see comment above); we only select fields, which PostgREST handles reliably.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from("inventory_identifiers") as any)
    .select(
      "id, imei, serial_number, status, sold_at, color, damage_note, purchase_price, inventory_id, inventory:inventory(id, device_name, brand, grade, storage, selling_price, price_per_unit)",
      { count: "exact" },
    )
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

  type IdentifierRow = {
    id: string;
    imei: string | null;
    serial_number: string | null;
    status: string;
    sold_at: string | null;
    color: string | null;
    damage_note: string | null;
    purchase_price: number | null;
    inventory_id: string;
    inventory: {
      device_name: string;
      brand: string;
      grade: string;
      storage: string;
      selling_price: number | null;
      price_per_unit: number | null;
    } | null;
  };

  const identifierRows = (rows ?? []) as IdentifierRow[];
  if (identifierRows.length === 0) return { data: [], count: count ?? 0 };

  const data: IdentifierListItem[] = identifierRows.map((row) => {
    const inv = row.inventory;
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
      sellingPrice: inv?.selling_price ?? null,
      purchasePrice: row.purchase_price ?? inv?.price_per_unit ?? null,
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
    .select(
      "id, inventory_id, imei, serial_number, status, sold_at, color, damage_note, purchase_price",
    )
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
    const { data: colorRows, error: colorError } = await supabase
      .from("inventory_colors")
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
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    item: dbRowToInventoryItem(invRow),
  };
}

// ── Centralized Write & Mutation Queries ──────────────────────────────────────

export async function updateInventoryProductQuery(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updates: any,
  companyId?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("inventory") as any).update(updates).eq("id", id);
  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  const { error } = await query;
  if (error) {
    throw error;
  }
}

export async function deleteInventoryProductQuery(id: string, companyId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("inventory") as any)
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) {
    throw error;
  }
}

export async function insertInventoryProductQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory") as any)
    .insert(payload)
    .select(INVENTORY_ADMIN_FIELDS)
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function bulkInsertInventoryQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insertData: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory") as any).insert(insertData).select();
  if (error) {
    throw error;
  }
  return data || [];
}

export async function findMatchingInventoryRowsQuery(params: {
  companyId: string;
  deviceName: string;
  brand: string;
  grade: string;
  storage: string;
  sellingPrice: number;
  isActive: boolean;
  hst: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory") as any)
    .select(INVENTORY_ADMIN_FIELDS)
    .eq("company_id", params.companyId)
    .eq("device_name", params.deviceName)
    .eq("brand", params.brand)
    .eq("grade", params.grade)
    .eq("storage", params.storage)
    .eq("selling_price", params.sellingPrice)
    .eq("is_active", params.isActive)
    .eq("hst", params.hst)
    .gt("quantity", 0);

  if (error) {
    throw error;
  }
  return data || [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchInventoryItemByIdQuery(id: string, companyId: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory") as any)
    .select(INVENTORY_ADMIN_FIELDS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function updateInventoryIdentifierQuery(
  identifierId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  companyId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("inventory_identifiers") as any)
    .update(payload)
    .eq("id", identifierId)
    .eq("company_id", companyId);

  if (error) {
    throw error;
  }
}

export async function deleteInventoryIdentifierQuery(
  identifierId: string,
  companyId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("inventory_identifiers") as any)
    .delete()
    .eq("id", identifierId)
    .eq("company_id", companyId);

  if (error) {
    throw error;
  }
}

export async function insertInventoryIdentifierQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("inventory_identifiers") as any).insert(payload);

  if (error) {
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lookupIdentifierForSaleQuery(q: string, companyId: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory_identifiers") as any)
    .select("id, inventory_id, imei, serial_number, status, color, damage_note")
    .eq("company_id", companyId)
    .or(`imei.eq.${q},serial_number.eq.${q}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function markIdentifierSoldQuery(
  identifierId: string,
  companyId: string,
  now: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory_identifiers") as any)
    .update({
      status: "sold",
      sold_at: now,
      updated_at: now,
    })
    .eq("id", identifierId)
    .eq("company_id", companyId)
    .in("status", ["in_stock", "reserved"])
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function revertIdentifierSoldQuery(
  identifierId: string,
  companyId: string,
  now: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("inventory_identifiers") as any)
    .update({
      status: "in_stock",
      sold_at: null,
      updated_at: now,
    })
    .eq("id", identifierId)
    .eq("company_id", companyId)
    .eq("status", "sold");

  if (error) {
    throw error;
  }
}

export async function upsertInventoryColorsQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  onConflict: string = "inventory_id,color",
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("inventory_colors") as any).upsert(rows, { onConflict });

  if (error) {
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchInventoryColorsQuery(ids: string[]): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory_colors") as any)
    .select("color, quantity")
    .in("inventory_id", ids)
    .gt("quantity", 0)
    .order("color");

  if (error) {
    throw error;
  }
  return data || [];
}

export async function deleteInventoryColorsQuery(
  inventoryId: string,
  colors?: string[],
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("inventory_colors") as any).delete().eq("inventory_id", inventoryId);
  if (colors && colors.length > 0) {
    query = query.in("color", colors);
  }
  const { error } = await query;
  if (error) {
    throw error;
  }
}

/**
 * Fetch unique colour names used across a set of inventory IDs.
 * Used to build colour suggestions when the colour dialog is opened
 * for a device that already has siblings in the same brand/model family.
 */
export async function fetchColorSuggestionsByInventoryIdsQuery(
  inventoryIds: string[],
): Promise<string[]> {
  if (inventoryIds.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory_colors") as any)
    .select("color")
    .in("inventory_id", inventoryIds);
  if (error || !data) return [];
  return [...new Set((data as Array<{ color: string }>).map((r) => r.color))].sort();
}

/**
 * Fetch colour rows (color + quantity) for a single inventory item.
 * Used to pre-populate the colour breakdown dialog during a legacy restock.
 */
export async function fetchColorRowsByItemIdQuery(
  inventoryId: string,
): Promise<Array<{ color: string; quantity: number }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory_colors") as any)
    .select("color, quantity")
    .eq("inventory_id", inventoryId)
    .order("color");
  if (error) console.error("Failed to load existing colors:", error);
  return (data as Array<{ color: string; quantity: number }>) ?? [];
}

/**
 * Fetch the live quantity for a single inventory row.
 * Used to get an authoritative count from DB (avoids stale in-memory value
 * in the restock merge preview).
 */
export async function fetchInventoryQuantityQuery(
  itemId: string,
  companyId: string,
): Promise<number | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory") as any)
    .select("quantity")
    .eq("id", itemId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) return null;
  const qty = (data as { quantity?: number } | null)?.quantity;
  return typeof qty === "number" ? qty : null;
}

/**
 * Check whether any of the supplied IMEI/serial values already exist in
 * inventory_identifiers for the company. Returns the set of values that
 * are already registered, so callers can surface precise duplicates.
 */
export async function checkDuplicateIdentifiersQuery(
  companyId: string,
  imeiValues: string[],
  serialValues: string[],
): Promise<{ existingImeis: Set<string>; existingSerials: Set<string> }> {
  const existingImeis = new Set<string>();
  const existingSerials = new Set<string>();

  if (imeiValues.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("inventory_identifiers") as any)
      .select("imei")
      .eq("company_id", companyId)
      .in("imei", imeiValues);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ imei: string | null }>) {
      if (row.imei) existingImeis.add(row.imei.toLowerCase());
    }
  }

  if (serialValues.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("inventory_identifiers") as any)
      .select("serial_number")
      .eq("company_id", companyId)
      .in("serial_number", serialValues);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ serial_number: string | null }>) {
      if (row.serial_number) existingSerials.add(row.serial_number.toLowerCase());
    }
  }

  return { existingImeis, existingSerials };
}

/**
 * Check whether any of the supplied IMEI/serial values already exist in
 * the inventory table for the company. Returns the set of values that
 * are already registered, so callers can surface precise duplicates.
 */
export async function checkDuplicateInventoryQuery(
  companyId: string,
  imeiValues: string[],
  serialValues: string[],
): Promise<{ existingImeis: Set<string>; existingSerials: Set<string> }> {
  const existingImeis = new Set<string>();
  const existingSerials = new Set<string>();

  if (imeiValues.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("inventory") as any)
      .select("imei")
      .eq("company_id", companyId)
      .in("imei", imeiValues);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ imei: string | null }>) {
      if (row.imei) existingImeis.add(row.imei.toLowerCase());
    }
  }

  if (serialValues.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("inventory") as any)
      .select("serial_number")
      .eq("company_id", companyId)
      .in("serial_number", serialValues);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ serial_number: string | null }>) {
      if (row.serial_number) existingSerials.add(row.serial_number.toLowerCase());
    }
  }

  return { existingImeis, existingSerials };
}

export interface IdentifierLabelRow {
  id: string;
  imei: string | null;
  serial_number: string | null;
  color: string | null;
  damage_note?: string | null;
}

/**
 * Fetch identifier details (imei, serial, color, damage_note) for a list of identifier IDs.
 */
export async function fetchIdentifierLabelsQuery(ids: string[]): Promise<IdentifierLabelRow[]> {
  if (ids.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory_identifiers") as any)
    .select("id, imei, serial_number, color, damage_note")
    .in("id", ids);
  if (error) {
    console.error("Failed to fetch identifier labels:", error);
    throw error;
  }
  return data ?? [];
}

export interface AvailableIdentifierRow {
  id: string;
  inventory_id: string;
  imei: string | null;
  serial_number: string | null;
  color: string | null;
}

/**
 * Fetch available identifiers (in stock / reserved) for list of item inventory IDs.
 */
export async function fetchAvailableIdentifiersQuery(
  itemIds: string[],
): Promise<AvailableIdentifierRow[]> {
  if (itemIds.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory_identifiers") as any)
    .select("id, inventory_id, imei, serial_number, color")
    .in("inventory_id", itemIds)
    .in("status", ["in_stock", "reserved"]);
  if (error) {
    console.error("Failed to fetch available identifiers:", error);
    throw error;
  }
  return data ?? [];
}

/**
 * Delete colors for multiple inventory IDs.
 */
export async function deleteInventoryColorsByInventoryIdsQuery(
  inventoryIds: string[],
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("inventory_colors") as any)
    .delete()
    .in("inventory_id", inventoryIds);
  if (error) throw error;
}

/**
 * Check how many orders reference this product ID in their JSONB items array.
 */
export async function checkOrderProductReferencesQuery(
  companyId: string,
  productId: string,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase.from("orders") as any)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .filter("items", "cs", JSON.stringify([{ item: { id: productId } }]));
  if (error) throw error;
  return count ?? 0;
}

/**
 * Delete inventory rows safely by their IDs and company ID.
 */
export async function deleteInventoryItemsQuery(ids: string[], companyId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("inventory") as any)
    .delete()
    .in("id", ids)
    .eq("company_id", companyId);
  if (error) throw error;
}

/**
 * Loads all active (in-stock, reserved, damaged) identifiers for a company, including their joined inventory details.
 */
export async function fetchAllActiveIdentifiersQuery(
  companyId: string,
): Promise<IdentifierSaleLookup[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory_identifiers") as any)
    .select(
      `id, imei, serial_number, status, color, damage_note, purchase_price, inventory!inner(${INVENTORY_ADMIN_FIELDS})`,
    )
    .eq("company_id", companyId)
    .in("status", ["in_stock", "reserved", "damaged"]);

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    identifierId: row.id as string,
    imei: (row.imei as string | null) ?? null,
    serialNumber: (row.serial_number as string | null) ?? null,
    status: String(row.status ?? "in_stock"),
    color: (row.color as string | null) ?? null,
    damageNote: (row.damage_note as string | null) ?? null,
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    item: dbRowToInventoryItem(row.inventory),
  }));
}
