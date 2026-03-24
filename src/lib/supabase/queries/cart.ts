/**
 * Cart price verification queries
 * Functions for verifying cart item prices and availability
 */

import { supabase } from "../client/browser";

export interface LatestInventoryPrice {
  id: string;
  deviceName: string;
  sellingPrice: number;
  quantity: number;
}

/**
 * Fetch the latest prices and quantities for specific inventory items
 * Used to verify cart items before checkout
 */
export async function fetchLatestPricesForItems(
  itemIds: string[]
): Promise<LatestInventoryPrice[]> {
  if (itemIds.length === 0) return [];

  const { data, error } = await supabase
    .from("inventory")
    .select("id, device_name, selling_price, price_per_unit, quantity")
    .in("id", itemIds);

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    deviceName: row.device_name,
    sellingPrice:
      row.selling_price != null
        ? Number(row.selling_price)
        : Number(row.price_per_unit),
    quantity: row.quantity,
  }));
}
