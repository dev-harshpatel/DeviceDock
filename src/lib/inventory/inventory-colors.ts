export interface InventoryColorQuantityRow {
  color: string;
  quantity: number;
}

/**
 * Replaces the full colour breakdown for an inventory row (upsert + delete removed colours).
 * Use after new inventory insert or when overwriting breakdown.
 */
export const replaceInventoryColors = async (
  supabase: any,
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
    const { error: upsertError } = await supabase
      .from("inventory_colors")
      .upsert(validRows, { onConflict: "inventory_id,color" });
    if (upsertError) throw upsertError;

    const keptColors = validRows.map((row) => row.color);
    const { data: existing, error: existingError } = await supabase
      .from("inventory_colors")
      .select("color")
      .eq("inventory_id", inventoryId);
    if (existingError) throw existingError;

    const toDelete = (existing ?? [])
      .map((row: { color: string }) => row.color)
      .filter((color: string) => !keptColors.includes(color));
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("inventory_colors")
        .delete()
        .eq("inventory_id", inventoryId)
        .in("color", toDelete);
      if (deleteError) throw deleteError;
    }
    return;
  }

  const { error: clearError } = await supabase
    .from("inventory_colors")
    .delete()
    .eq("inventory_id", inventoryId);
  if (clearError) throw clearError;
};

/** Removes all aggregate colour rows for a SKU (e.g. when stock hits zero). */
export const deleteAllInventoryColors = async (
  supabase: any,
  inventoryId: string,
): Promise<void> => {
  const { error } = await supabase
    .from("inventory_colors")
    .delete()
    .eq("inventory_id", inventoryId);
  if (error) throw error;
};

/** Aggregate colour rows with quantity > 0 for SKU-level display.
 *  Accepts a single ID or an array (grouped rows share the same spec). */
export const fetchPositiveInventoryColors = async (
  supabase: any,
  inventoryId: string | string[],
): Promise<InventoryColorQuantityRow[]> => {
  const ids = Array.isArray(inventoryId) ? inventoryId : [inventoryId];
  const { data, error } = await supabase
    .from("inventory_colors")
    .select("color, quantity")
    .in("inventory_id", ids)
    .gt("quantity", 0)
    .order("color");
  if (error) throw error;

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
 */
export const mergeInventoryColorsAdditive = async (
  supabase: any,
  inventoryId: string,
  newRows: InventoryColorQuantityRow[],
): Promise<void> => {
  const validRows = newRows.filter((r) => r.color.trim() && r.quantity > 0);
  if (validRows.length === 0) return;

  const { data: existing, error: existingError } = await supabase
    .from("inventory_colors")
    .select("color, quantity")
    .eq("inventory_id", inventoryId);
  if (existingError) throw existingError;

  const existingMap = new Map<string, number>(
    (existing ?? []).map((row: { color: string; quantity: number }) => [row.color, row.quantity]),
  );

  const mergedRows = validRows.map((row) => ({
    inventory_id: inventoryId,
    color: row.color.trim(),
    quantity: (existingMap.get(row.color.trim()) ?? 0) + row.quantity,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("inventory_colors")
    .upsert(mergedRows, { onConflict: "inventory_id,color" });
  if (upsertError) throw upsertError;
};

/** Applies a +/- quantity delta for one colour on one inventory row. */
export const applyInventoryColorDelta = async (
  supabase: any,
  inventoryId: string,
  color: string | null,
  delta: number,
): Promise<void> => {
  const normalizedColor = color?.trim() ?? "";
  if (!normalizedColor || delta === 0) return;

  const { data, error } = await supabase
    .from("inventory_colors")
    .select("quantity")
    .eq("inventory_id", inventoryId)
    .eq("color", normalizedColor)
    .maybeSingle();
  if (error) throw error;

  const currentQuantity = Number((data as { quantity?: number } | null)?.quantity ?? 0);
  const nextQuantity = currentQuantity + delta;

  if (nextQuantity > 0) {
    const { error: upsertError } = await supabase.from("inventory_colors").upsert(
      {
        inventory_id: inventoryId,
        color: normalizedColor,
        quantity: nextQuantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "inventory_id,color" },
    );
    if (upsertError) throw upsertError;
    return;
  }

  const { error: deleteError } = await supabase
    .from("inventory_colors")
    .delete()
    .eq("inventory_id", inventoryId)
    .eq("color", normalizedColor);
  if (deleteError) throw deleteError;
};
