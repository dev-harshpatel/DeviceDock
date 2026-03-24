import type { InventoryItem } from "@/data/inventory";

export type WishStatus =
  | "pending"
  | "offered"
  | "reserved"
  | "ordered"
  | "fulfilled"
  | "rejected"
  | "cancelled";

/** User-facing wish — contains NO admin-only fields */
export interface Wish {
  id: string;
  userId: string;
  model: string;
  grade: string;
  storage: string;
  qtyWanted: number;
  maxPricePerUnit: number | null;
  status: WishStatus;
  offerPricePerUnit?: number | null;
  offerQty?: number | null;
  offerCreatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WishWithInventory extends Wish {
  offerItem?: InventoryItem | null;
}

/** Admin-only extension — never sent to the user's browser */
export interface AdminWish extends Wish {
  offerInventoryItemId?: string | null;
  adminNotes?: string | null;
}

export interface AdminWishWithInventory extends AdminWish {
  offerItem?: InventoryItem | null;
}
