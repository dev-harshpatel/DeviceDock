import { InventoryItem, calculatePricePerUnit, getStockStatus } from "@/data/inventory";
import type { InventorySortBy } from "@/components/common/FilterBar";
import type { InventoryFilters } from "@/lib/supabase/queries";

const getGroupKey = (item: InventoryItem): string =>
  [
    item.brand.trim().toLowerCase(),
    item.deviceName.trim().toLowerCase(),
    item.grade,
    item.storage.trim().toLowerCase(),
    item.hst ?? 0,
    item.isActive ?? true,
  ].join("|");

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

export const groupMatchingInventoryItems = (items: readonly InventoryItem[]): InventoryItem[] => {
  const groups = new Map<string, InventoryItem>();

  for (const item of items) {
    const key = getGroupKey(item);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, { ...item, inventoryIds: [item.id] });
      continue;
    }

    const totalQuantity = existing.quantity + item.quantity;
    const totalPurchasePrice = (existing.purchasePrice ?? 0) + (item.purchasePrice ?? 0);
    const weightedSellingTotal =
      existing.sellingPrice * existing.quantity + item.sellingPrice * item.quantity;

    groups.set(key, {
      ...existing,
      inventoryIds: [...(existing.inventoryIds ?? [existing.id]), item.id],
      quantity: totalQuantity,
      purchasePrice: roundCurrency(totalPurchasePrice),
      pricePerUnit: calculatePricePerUnit(totalPurchasePrice, totalQuantity, existing.hst ?? 0),
      sellingPrice: totalQuantity > 0 ? roundCurrency(weightedSellingTotal / totalQuantity) : 0,
    });
  }

  return Array.from(groups.values());
};

export const filterInventoryItems = (
  items: readonly InventoryItem[],
  filters: InventoryFilters,
): InventoryItem[] =>
  items.filter((item) => {
    if (filters.search && !item.deviceName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.brand !== "all" && item.brand !== filters.brand) return false;
    if (filters.grade !== "all" && item.grade !== filters.grade) return false;
    if (filters.storage !== "all" && item.storage !== filters.storage) return false;

    if (filters.priceRange !== "all") {
      if (filters.priceRange === "under200" && item.sellingPrice >= 200) return false;
      if (
        filters.priceRange === "200-400" &&
        (item.sellingPrice < 200 || item.sellingPrice > 400)
      ) {
        return false;
      }
      if (filters.priceRange === "400+" && item.sellingPrice < 400) return false;
    }

    if (filters.stockStatus !== "all" && getStockStatus(item.quantity) !== filters.stockStatus) {
      return false;
    }

    return true;
  });

export const sortInventoryItems = (
  items: readonly InventoryItem[],
  sortBy: InventorySortBy,
): InventoryItem[] => {
  const sorted = [...items];

  switch (sortBy) {
    case "created_desc":
      return sorted.reverse();
    case "purchase_desc":
      return sorted.sort((a, b) => (b.purchasePrice ?? 0) - (a.purchasePrice ?? 0));
    case "purchase_asc":
      return sorted.sort((a, b) => (a.purchasePrice ?? 0) - (b.purchasePrice ?? 0));
    case "selling_stock_desc":
      return sorted.sort((a, b) => b.sellingPrice * b.quantity - a.sellingPrice * a.quantity);
    case "selling_stock_asc":
      return sorted.sort((a, b) => a.sellingPrice * a.quantity - b.sellingPrice * b.quantity);
    case "qty_desc":
      return sorted.sort((a, b) => b.quantity - a.quantity);
    case "qty_asc":
      return sorted.sort((a, b) => a.quantity - b.quantity);
    case "created_asc":
    default:
      return sorted;
  }
};
