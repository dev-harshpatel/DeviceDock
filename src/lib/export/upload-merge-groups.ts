import type { ParsedProduct } from "@/types/upload";
import type { InventoryColorQuantityRow } from "@/lib/inventory/inventory-colors";
import { skuKeyForUploadProduct } from "@/lib/export/upload-identifier-validation";

/**
 * Splits valid parsed rows into legacy (one inventory row per sheet row) and unit-row groups (merge by SKU).
 */
export const partitionParsedProductsForUpload = (
  products: ParsedProduct[],
): {
  legacyRows: ParsedProduct[];
  unitGroups: ParsedProduct[][];
} => {
  const legacyRows: ParsedProduct[] = [];
  const unitByKey = new Map<string, ParsedProduct[]>();

  for (const p of products) {
    if (p.parseMode === "legacy_row") {
      legacyRows.push(p);
      continue;
    }
    const key = skuKeyForUploadProduct(p);
    const list = unitByKey.get(key) ?? [];
    list.push(p);
    unitByKey.set(key, list);
  }

  return {
    legacyRows,
    unitGroups: [...unitByKey.values()],
  };
};

/** Counts colours from unit-row identifier rows for `inventory_colors`. */
export const aggregateColorsFromUnitGroup = (
  group: ParsedProduct[],
): InventoryColorQuantityRow[] => {
  const map = new Map<string, number>();
  for (const p of group) {
    const ident = p.identifiers[0];
    const c = ident?.color?.trim();
    if (c) {
      map.set(c, (map.get(c) ?? 0) + 1);
    }
  }
  return [...map.entries()].map(([color, quantity]) => ({ color, quantity }));
};
