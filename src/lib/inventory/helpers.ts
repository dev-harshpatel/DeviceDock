import { Database } from "@/lib/database.types";
import { InventoryItem } from "@/data/inventory";

type InventoryUpdate = Database["public"]["Tables"]["inventory"]["Update"];

export const toFiniteNumber = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
};

export const roundCurrency = (value: number, precision = 4): number =>
  Math.round(value * 10 ** precision) / 10 ** precision;

export const sameNumber = (a: number | null | undefined, b: number | null | undefined): boolean =>
  Math.abs((a ?? 0) - (b ?? 0)) < 0.0001;

export const toInventoryUpdate = (updates: Partial<InventoryItem>): InventoryUpdate => {
  const updateData: InventoryUpdate = {};

  if (updates.brand !== undefined) updateData.brand = updates.brand;
  if (updates.deviceName !== undefined) updateData.device_name = updates.deviceName;
  if (updates.grade !== undefined) updateData.grade = updates.grade;
  if (updates.lastUpdated !== undefined) updateData.last_updated = updates.lastUpdated;
  if (updates.priceChange !== undefined) updateData.price_change = updates.priceChange ?? null;
  if (updates.pricePerUnit !== undefined) {
    const numericValue = toFiniteNumber(Number(updates.pricePerUnit));
    if (numericValue !== null) {
      updateData.price_per_unit = numericValue;
    }
  }
  if (updates.purchasePrice !== undefined) {
    updateData.purchase_price =
      updates.purchasePrice != null ? toFiniteNumber(Number(updates.purchasePrice)) : null;
  }
  if (updates.hst !== undefined) {
    updateData.hst = updates.hst != null ? toFiniteNumber(Number(updates.hst)) : null;
  }
  if (updates.sellingPrice !== undefined) {
    const numericValue = toFiniteNumber(Number(updates.sellingPrice));
    if (numericValue !== null) {
      updateData.selling_price = numericValue;
    }
  }
  if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
  if (updates.storage !== undefined) updateData.storage = updates.storage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (updates.isActive !== undefined) (updateData as any).is_active = updates.isActive;
  return updateData;
};

export function productToInsertRow(product: InventoryItem, companyId: string) {
  return {
    company_id: companyId,
    device_name: product.deviceName,
    brand: product.brand,
    grade: product.grade,
    storage: product.storage,
    quantity: product.quantity,
    price_per_unit: product.pricePerUnit,
    purchase_price: product.purchasePrice ?? null,
    hst: product.hst ?? null,
    selling_price: product.sellingPrice,
    last_updated: product.lastUpdated || "Just now",
    price_change: product.priceChange ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
