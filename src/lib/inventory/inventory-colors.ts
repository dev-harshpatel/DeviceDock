import {
  upsertInventoryColorsQuery,
  fetchInventoryColorsQuery,
  deleteInventoryColorsQuery,
} from "../supabase/queries";

export interface InventoryColorQuantityRow {
  color: string;
  quantity: number;
}

/**
 * Replaces the full colour breakdown for an inventory row (upsert + delete removed colours).
 * Use after new inventory insert or when overwriting breakdown.
 * The _supabase param is kept for backward compatibility; DB calls go through the query layer.
 */
export const replaceInventoryColors = async (
  _supabase: unknown,
  inventoryId: string,
  rows: InventoryColorQuantityRow[],
): Promise<void> => {
  const validRows = rows
    .filter((row) => row.color.trim() && row.quantity > 0)
    .map((row) => ({
      inventory_id: inventoryId,
      color: row.color.trim(),
      quantity: row.quantity,
      updated_at: new Date().toISOString(),
    }));

  if (validRows.length > 0) {
    await upsertInventoryColorsQuery(validRows);

    const keptColors = validRows.map((row) => row.color);
    const existing = await fetchInventoryColorsQuery([inventoryId]);

    const toDelete = (existing ?? [])
      .map((row: { color: string }) => row.color)
      .filter((color: string) => !keptColors.includes(color));
    if (toDelete.length > 0) {
      await deleteInventoryColorsQuery(inventoryId, toDelete);
    }
    return;
  }

  await deleteInventoryColorsQuery(inventoryId);
};

/** Removes all aggregate colour rows for a SKU (e.g. when stock hits zero).
 *  The _supabase param is kept for backward compatibility.
 */
export const deleteAllInventoryColors = async (
  _supabase: unknown,
  inventoryId: string,
): Promise<void> => {
  await deleteInventoryColorsQuery(inventoryId);
};

/** Aggregate colour rows with quantity > 0 for SKU-level display.
 *  Accepts a single ID or an array (grouped rows share the same spec).
 *  The _supabase param is kept for backward compatibility.
 */
export const fetchPositiveInventoryColors = async (
  _supabase: unknown,
  inventoryId: string | string[],
): Promise<InventoryColorQuantityRow[]> => {
  const ids = Array.isArray(inventoryId) ? inventoryId : [inventoryId];
  const data = await fetchInventoryColorsQuery(ids);

  // Sum quantities across rows when multiple inventory IDs map to the same colour.
  const totals = new Map<string, number>();
  for (const row of (data ?? []) as InventoryColorQuantityRow[]) {
    totals.set(row.color, (totals.get(row.color) ?? 0) + row.quantity);
  }
  return Array.from(totals.entries())
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([color, quantity]) => ({ color, quantity }));
};

/**
 * Merges additive colour quantities into existing DB rows (restock / additive flows).
 * The _supabase param is kept for backward compatibility.
 */
export const mergeInventoryColorsAdditive = async (
  _supabase: unknown,
  inventoryId: string,
  newRows: InventoryColorQuantityRow[],
): Promise<void> => {
  const validRows = newRows.filter((r) => r.color.trim() && r.quantity > 0);
  if (validRows.length === 0) return;

  const existing = await fetchInventoryColorsQuery([inventoryId]);

  const existingMap = new Map<string, number>(
    (existing ?? []).map((row: { color: string; quantity: number }) => [row.color, row.quantity]),
  );

  const mergedRows = validRows.map((row) => ({
    inventory_id: inventoryId,
    color: row.color.trim(),
    quantity: (existingMap.get(row.color.trim()) ?? 0) + row.quantity,
    updated_at: new Date().toISOString(),
  }));

  await upsertInventoryColorsQuery(mergedRows);
};

/** Applies a +/- quantity delta for one colour on one inventory row.
 *  The _supabase param is kept for backward compatibility.
 */
export const applyInventoryColorDelta = async (
  _supabase: unknown,
  inventoryId: string,
  color: string | null,
  delta: number,
): Promise<void> => {
  const normalizedColor = color?.trim() ?? "";
  if (!normalizedColor || delta === 0) return;

  const existing = await fetchInventoryColorsQuery([inventoryId]);
  const matched = existing.find((row) => row.color === normalizedColor);

  const currentQuantity = Number(matched?.quantity ?? 0);
  const nextQuantity = currentQuantity + delta;

  if (nextQuantity > 0) {
    await upsertInventoryColorsQuery([
      {
        inventory_id: inventoryId,
        color: normalizedColor,
        quantity: nextQuantity,
        updated_at: new Date().toISOString(),
      },
    ]);
    return;
  }

  await deleteInventoryColorsQuery(inventoryId, [normalizedColor]);
};
