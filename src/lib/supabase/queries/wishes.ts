import { supabase } from "../client/browser";
import type {
  Wish,
  WishStatus,
  WishWithInventory,
  AdminWish,
  AdminWishWithInventory,
} from "@/types/wish";
import type { Database } from "@/lib/database.types";
import { dbRowToInventoryItem } from "./mappers";

type WishRow = Database["public"]["Tables"]["wishes"]["Row"];

const ADMIN_WISH_FIELDS = [
  "id",
  "user_id",
  "model",
  "grade",
  "storage",
  "qty_wanted",
  "max_price_per_unit",
  "status",
  "offer_price_per_unit",
  "offer_qty",
  "offer_inventory_item_id",
  "offer_created_at",
  "admin_notes",
  "created_at",
  "updated_at",
].join(", ");

const ADMIN_WISH_WITH_INVENTORY_SELECT = `
  ${ADMIN_WISH_FIELDS},
  inventory:offer_inventory_item_id (
    id, device_name, brand, grade, storage, quantity, selling_price,
    purchase_price, hst, price_per_unit, is_active, last_updated
  )
` as const;

// Columns fetched for the user — admin-only fields (admin_notes,
// offer_inventory_item_id) are intentionally excluded so they never
// appear in the user's network tab.
const USER_WISH_SELECT = `
  id,
  user_id,
  model,
  grade,
  storage,
  qty_wanted,
  max_price_per_unit,
  status,
  offer_price_per_unit,
  offer_qty,
  offer_created_at,
  created_at,
  updated_at,
  inventory:offer_inventory_item_id (
    id, device_name, brand, grade, storage, quantity,
    selling_price, is_active, last_updated
  )
` as const;

/** Maps a DB row to the user-facing Wish (no admin fields). */
function rowToUserWish(row: any): Wish {
  return {
    id: row.id,
    userId: row.user_id,
    model: row.model,
    grade: row.grade,
    storage: row.storage,
    qtyWanted: row.qty_wanted,
    maxPricePerUnit: row.max_price_per_unit != null ? Number(row.max_price_per_unit) : null,
    status: row.status as WishStatus,
    offerPricePerUnit: row.offer_price_per_unit != null ? Number(row.offer_price_per_unit) : null,
    offerQty: row.offer_qty ?? null,
    offerCreatedAt: row.offer_created_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Maps a DB row to the admin-facing AdminWish (includes admin-only fields). */
function rowToAdminWish(row: WishRow): AdminWish {
  return {
    id: row.id,
    userId: row.user_id,
    model: row.model,
    grade: row.grade,
    storage: row.storage,
    qtyWanted: row.qty_wanted,
    maxPricePerUnit: row.max_price_per_unit != null ? Number(row.max_price_per_unit) : null,
    status: row.status as WishStatus,
    offerPricePerUnit: row.offer_price_per_unit != null ? Number(row.offer_price_per_unit) : null,
    offerQty: row.offer_qty ?? null,
    offerInventoryItemId: row.offer_inventory_item_id ?? null,
    offerCreatedAt: row.offer_created_at ?? null,
    adminNotes: row.admin_notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchUserWishes(userId: string): Promise<WishWithInventory[]> {
  const { data, error } = await supabase
    .from("wishes")
    .select(USER_WISH_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map((row) => ({
    ...rowToUserWish(row),
    offerItem: row.inventory ? dbRowToInventoryItem(row.inventory) : null,
  }));
}

export interface CreateWishInput {
  model: string;
  grade: string;
  storage: string;
  qtyWanted: number;
  maxPricePerUnit?: number | null;
}

export async function createWish(userId: string, input: CreateWishInput): Promise<Wish> {
  const payload: Database["public"]["Tables"]["wishes"]["Insert"] = {
    user_id: userId,
    model: input.model.trim(),
    grade: input.grade.trim(),
    storage: input.storage.trim(),
    qty_wanted: input.qtyWanted,
    max_price_per_unit: input.maxPricePerUnit ?? null,
  };

  const { data, error } = await (supabase as any)
    .from("wishes")
    .insert(payload)
    .select(
      "id, user_id, model, grade, storage, qty_wanted, max_price_per_unit, status, offer_price_per_unit, offer_qty, offer_created_at, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create wish");
  }

  return rowToUserWish(data);
}

export interface UpdateWishInput {
  status?: WishStatus;
  maxPricePerUnit?: number;
  qtyWanted?: number;
}

export async function updateWish(id: string, input: UpdateWishInput): Promise<Wish> {
  const update: Database["public"]["Tables"]["wishes"]["Update"] = {};

  if (input.status) update.status = input.status;
  if (input.maxPricePerUnit != null) update.max_price_per_unit = input.maxPricePerUnit;
  if (input.qtyWanted != null) update.qty_wanted = input.qtyWanted;

  const { data, error } = await (supabase as any)
    .from("wishes")
    .update(update)
    .eq("id", id)
    .select(
      "id, user_id, model, grade, storage, qty_wanted, max_price_per_unit, status, offer_price_per_unit, offer_qty, offer_created_at, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to update wish");
  }

  return rowToUserWish(data);
}

export interface AdminOfferInput {
  status: Extract<WishStatus, "offered" | "rejected" | "fulfilled">;
  offerPricePerUnit?: number | null;
  offerQty?: number | null;
  offerInventoryItemId?: string | null;
  adminNotes?: string | null;
}

export async function setAdminOffer(id: string, input: AdminOfferInput): Promise<AdminWish> {
  const update: Database["public"]["Tables"]["wishes"]["Update"] = {
    status: input.status,
  };

  if (input.offerPricePerUnit !== undefined) update.offer_price_per_unit = input.offerPricePerUnit;
  if (input.offerQty !== undefined) update.offer_qty = input.offerQty;
  if (input.offerInventoryItemId !== undefined)
    update.offer_inventory_item_id = input.offerInventoryItemId;
  if (input.adminNotes !== undefined) update.admin_notes = input.adminNotes;

  if (input.status === "offered") {
    update.offer_created_at = new Date().toISOString();
  }

  const { data, error } = await (supabase as any)
    .from("wishes")
    .update(update)
    .eq("id", id)
    .select(ADMIN_WISH_FIELDS)
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to set admin offer");
  }

  return rowToAdminWish(data as WishRow);
}

export async function fetchAllWishesForAdmin(): Promise<AdminWishWithInventory[]> {
  // Note: we do NOT join auth.users here — PostgREST cannot access auth.users
  // from the browser client. The admin component fetches emails separately
  // via /api/users/emails (same pattern as Orders.tsx).
  const { data, error } = await supabase
    .from("wishes")
    .select(ADMIN_WISH_WITH_INVENTORY_SELECT)
    .order("created_at", { ascending: false });

  if (error || !data) {
    throw error ?? new Error("Failed to fetch wishes");
  }

  return data.map((row: any) => ({
    ...rowToAdminWish(row as WishRow),
    offerItem: row.inventory ? dbRowToInventoryItem(row.inventory) : null,
  }));
}

export async function fetchModelSuggestions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("device_name")
    .eq("is_active", true);

  if (error || !data) return [];

  return Array.from(
    new Set((data as Array<{ device_name: string | null }>).map((row) => row.device_name)),
  )
    .filter(Boolean)
    .sort() as string[];
}

export async function fetchStorageOptionsByModel(model: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("storage")
    .eq("device_name", model)
    .eq("is_active", true);

  if (error || !data) return [];

  return Array.from(new Set((data as Array<{ storage: string | null }>).map((row) => row.storage)))
    .filter(Boolean)
    .sort() as string[];
}
