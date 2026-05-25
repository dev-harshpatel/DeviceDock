"use client";

import { calculatePricePerUnit, InventoryItem } from "@/data/inventory";
import { Database } from "@/lib/database.types";
import { useAuth } from "@/lib/auth/context";
import { useCompany } from "@/contexts/CompanyContext";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { IdentifierFullLookup, IdentifierSaleLookup } from "@/types/inventory-identifiers";
import { UploadHistory, BulkInsertResult } from "@/types/upload";
import {
  dbRowToInventoryItem,
  INVENTORY_ADMIN_FIELDS,
  updateInventoryProductQuery,
  deleteInventoryProductQuery,
  insertInventoryProductQuery,
  bulkInsertInventoryQuery,
  findMatchingInventoryRowsQuery,
  fetchInventoryItemByIdQuery,
  updateInventoryIdentifierQuery,
  deleteInventoryIdentifierQuery,
  insertInventoryIdentifierQuery,
  lookupIdentifierForSaleQuery,
  markIdentifierSoldQuery,
  revertIdentifierSoldQuery,
  fetchUploadHistoryQuery,
  checkIdentifierOrderReferencesQuery,
} from "@/lib/supabase/queries";
import { BULK_INSERT_BATCH_SIZE } from "@/lib/constants";
import {
  applyInventoryColorDelta,
  deleteAllInventoryColors,
} from "@/lib/inventory/inventory-colors";
import type { Grade } from "@/lib/constants/grades";
import {
  roundCurrency,
  sameNumber,
  toInventoryUpdate,
  productToInsertRow,
} from "@/lib/inventory/helpers";

type InventoryUpdate = Database["public"]["Tables"]["inventory"]["Update"];

export function useInventoryActions() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const queryClient = useQueryClient();

  const updateProduct = useCallback(
    async (id: string, updates: Partial<InventoryItem>) => {
      const updateData: InventoryUpdate = toInventoryUpdate({
        ...updates,
        lastUpdated: "Just now",
      });
      updateData.updated_at = new Date().toISOString();

      await updateInventoryProductQuery(id, updateData, companyId ?? undefined);

      if (updates.quantity === 0) {
        await deleteAllInventoryColors(null, id);
      }

      // Reflect the change in the cache immediately so consumers see it without waiting for
      // the next background refetch (realtime will trigger a full sync shortly after).
      queryClient.setQueryData<InventoryItem[]>(queryKeys.inventoryAll(companyId), (old) =>
        (old ?? []).map((item) =>
          item.id === id ? { ...item, ...updates, lastUpdated: "Just now" } : item,
        ),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
        queryClient.invalidateQueries({ queryKey: queryKeys.identifiersList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.identifierMapAll(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats(companyId) }),
      ]);
    },
    [companyId, queryClient],
  );

  const updateInventoryIdentifier = useCallback(
    async (
      identifierId: string,
      updates: { color?: string | null; damageNote?: string | null },
    ): Promise<void> => {
      if (!companyId) {
        throw new Error("No active company context");
      }

      const updateData: { color?: string | null; damage_note?: string | null; updated_at: string } =
        {
          updated_at: new Date().toISOString(),
        };

      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.damageNote !== undefined) updateData.damage_note = updates.damageNote;

      if (Object.keys(updateData).length <= 1) return;

      await updateInventoryIdentifierQuery(identifierId, updateData, companyId);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.identifiersList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.identifierMapAll(companyId) }),
      ]);
    },
    [companyId, queryClient],
  );

  const updateIdentifierUnit = useCallback(
    async (input: {
      lookup: IdentifierFullLookup;
      color: string | null;
      grade: Grade;
      storage: string;
      pricePerUnit: number;
      sellingPrice: number;
      hst: number | null;
      damageNote?: string | null;
    }): Promise<void> => {
      if (!companyId) {
        throw new Error("No active company context");
      }

      const { lookup, color, grade, storage, pricePerUnit, sellingPrice, hst, damageNote } = input;
      const sourceItem = lookup.item;
      const sourceStatus = lookup.status;
      const normalizedColor = color?.trim() || null;
      const nextHst = hst ?? 0;
      // pricePerUnit from the editor is already the BASE cost (pre-HST).
      const nextBasePurchase = roundCurrency(pricePerUnit);
      const nextStoredPricePerUnit = calculatePricePerUnit(nextBasePurchase, 1, nextHst);
      const sharedFieldsChanged =
        grade !== sourceItem.grade ||
        storage.trim() !== sourceItem.storage ||
        !sameNumber(nextStoredPricePerUnit, sourceItem.pricePerUnit) ||
        !sameNumber(sellingPrice, sourceItem.sellingPrice) ||
        !sameNumber(nextHst, sourceItem.hst);

      if (sourceStatus !== "in_stock" && sourceStatus !== "reserved") {
        throw new Error("Only in-stock or reserved units can be edited individually.");
      }

      const sourceColor = lookup.color?.trim() || null;
      const nowIso = new Date().toISOString();

      if (!sharedFieldsChanged) {
        await updateInventoryIdentifier(lookup.identifierId, {
          color: normalizedColor,
          ...(damageNote !== undefined && { damageNote }),
        });

        if (sourceColor !== normalizedColor) {
          await applyInventoryColorDelta(null, sourceItem.id, sourceColor, -1);
          await applyInventoryColorDelta(null, sourceItem.id, normalizedColor, 1);
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
          queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAll(companyId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.identifiersList }),
          queryClient.invalidateQueries({ queryKey: queryKeys.identifierMapAll(companyId) }),
        ]);
        return;
      }

      const sourceQuantity = sourceItem.quantity;
      const sourcePurchasePrice = sourceItem.purchasePrice ?? 0;
      // Use the stored per-unit cost if present; otherwise fall back to the group average.
      const sourceUnitBaseCost =
        lookup.purchasePrice != null
          ? roundCurrency(lookup.purchasePrice)
          : sourceQuantity > 0
            ? roundCurrency(sourcePurchasePrice / sourceQuantity)
            : 0;

      // Try to merge this device into an existing matching per-device row before creating one.
      const candidateRows = await findMatchingInventoryRowsQuery({
        companyId,
        deviceName: sourceItem.deviceName,
        brand: sourceItem.brand,
        grade,
        storage: storage.trim(),
        sellingPrice,
        isActive: sourceItem.isActive ?? true,
        hst: nextHst,
      });

      const matchingTarget =
        ((candidateRows ?? []) as Array<Record<string, unknown>>)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((row) => dbRowToInventoryItem(row as any))
          .find(
            (row) =>
              row.id !== sourceItem.id && sameNumber(row.pricePerUnit, nextStoredPricePerUnit),
          ) ?? null;

      let targetInventoryId = sourceItem.id;

      if (sourceQuantity <= 1) {
        if (matchingTarget) {
          targetInventoryId = matchingTarget.id;
          const mergedQuantity = matchingTarget.quantity + 1;
          const mergedPurchase = roundCurrency(
            (matchingTarget.purchasePrice ?? 0) + nextBasePurchase,
          );
          await updateProduct(matchingTarget.id, {
            quantity: mergedQuantity,
            purchasePrice: mergedPurchase,
            pricePerUnit: calculatePricePerUnit(mergedPurchase, mergedQuantity, nextHst),
          });

          await updateInventoryIdentifierQuery(
            lookup.identifierId,
            {
              inventory_id: matchingTarget.id,
              color: normalizedColor,
              ...(damageNote !== undefined && { damage_note: damageNote }),
              updated_at: nowIso,
            },
            companyId,
          );

          await applyInventoryColorDelta(null, sourceItem.id, sourceColor, -1);
          await applyInventoryColorDelta(null, matchingTarget.id, normalizedColor, 1);

          await deleteInventoryProductQuery(sourceItem.id, companyId);

          await deleteAllInventoryColors(null, sourceItem.id);
        } else {
          await updateProduct(sourceItem.id, {
            grade,
            storage: storage.trim(),
            purchasePrice: nextBasePurchase,
            pricePerUnit: nextStoredPricePerUnit,
            sellingPrice,
            hst: nextHst,
          });

          await updateInventoryIdentifier(lookup.identifierId, {
            color: normalizedColor,
            ...(damageNote !== undefined && { damageNote }),
          });

          if (sourceColor !== normalizedColor) {
            await applyInventoryColorDelta(null, sourceItem.id, sourceColor, -1);
            await applyInventoryColorDelta(null, sourceItem.id, normalizedColor, 1);
          }
        }
      } else {
        if (matchingTarget) {
          targetInventoryId = matchingTarget.id;
          const mergedQuantity = matchingTarget.quantity + 1;
          const mergedPurchase = roundCurrency(
            (matchingTarget.purchasePrice ?? 0) + nextBasePurchase,
          );
          await updateProduct(matchingTarget.id, {
            quantity: mergedQuantity,
            purchasePrice: mergedPurchase,
            pricePerUnit: calculatePricePerUnit(mergedPurchase, mergedQuantity, nextHst),
          });
        } else {
          const insertedRow = await insertInventoryProductQuery({
            company_id: companyId,
            device_name: sourceItem.deviceName,
            brand: sourceItem.brand,
            grade,
            storage: storage.trim(),
            quantity: 1,
            price_per_unit: nextStoredPricePerUnit,
            purchase_price: nextBasePurchase,
            hst: nextHst,
            selling_price: sellingPrice,
            last_updated: "Just now",
            price_change: sourceItem.priceChange ?? null,
            is_active: sourceItem.isActive ?? true,
            created_at: nowIso,
            updated_at: nowIso,
          });
          if (!insertedRow) {
            throw new Error("Failed to create a split inventory row");
          }
          targetInventoryId = String((insertedRow as { id: string }).id);
        }

        const nextSourceQuantity = sourceQuantity - 1;
        const nextSourcePurchase = roundCurrency(
          Math.max(0, sourcePurchasePrice - sourceUnitBaseCost),
        );
        await updateProduct(sourceItem.id, {
          quantity: nextSourceQuantity,
          purchasePrice: nextSourcePurchase,
          pricePerUnit: calculatePricePerUnit(
            nextSourcePurchase,
            nextSourceQuantity,
            sourceItem.hst ?? 0,
          ),
        });

        await updateInventoryIdentifierQuery(
          lookup.identifierId,
          {
            inventory_id: targetInventoryId,
            color: normalizedColor,
            ...(damageNote !== undefined && { damage_note: damageNote }),
            updated_at: nowIso,
          },
          companyId,
        );

        await applyInventoryColorDelta(null, sourceItem.id, sourceColor, -1);
        await applyInventoryColorDelta(null, targetInventoryId, normalizedColor, 1);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAll(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.identifiersList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.identifierMapAll(companyId) }),
      ]);
    },
    [companyId, queryClient, updateInventoryIdentifier, updateProduct],
  );

  const deleteIdentifierUnit = useCallback(
    async (input: { lookup: IdentifierFullLookup }): Promise<void> => {
      if (!companyId) throw new Error("No active company context");

      const { lookup } = input;
      const sourceItem = lookup.item;

      // Only in_stock and damaged units can be deleted; all others have order associations.
      const DELETABLE_STATUSES = new Set(["in_stock", "damaged"]);
      if (!DELETABLE_STATUSES.has(lookup.status)) {
        const reasons: Record<string, string> = {
          sold: "This unit has been sold and is linked to an order. Sold units cannot be deleted to preserve order history.",
          reserved:
            "This unit is reserved for a pending order. Cancel the reservation before deleting.",
          returned:
            "This unit has order history (returned). Delete is blocked to preserve order records.",
        };
        throw new Error(
          reasons[lookup.status] ?? `Units with status "${lookup.status}" cannot be deleted.`,
        );
      }

      // Belt-and-suspenders: confirm no order row references this identifier ID.
      const orderCount = await checkIdentifierOrderReferencesQuery(companyId, lookup.identifierId);
      if (orderCount > 0) {
        throw new Error("This unit is referenced in one or more orders and cannot be deleted.");
      }

      // Compute the base cost this unit contributed to the parent row.
      const unitCost =
        lookup.purchasePrice != null
          ? roundCurrency(lookup.purchasePrice)
          : sourceItem.quantity > 0
            ? roundCurrency((sourceItem.purchasePrice ?? 0) / sourceItem.quantity)
            : 0;

      const newQuantity = Math.max(0, sourceItem.quantity - 1);
      const newPurchasePrice = roundCurrency(
        Math.max(0, (sourceItem.purchasePrice ?? 0) - unitCost),
      );

      // Delete the identifier record first.
      await deleteInventoryIdentifierQuery(lookup.identifierId, companyId);

      // Remove this unit's colour contribution.
      if (lookup.color) {
        await applyInventoryColorDelta(null, sourceItem.id, lookup.color, -1);
      }

      if (newQuantity === 0) {
        // Last unit in this row — remove the inventory row and all its colours.
        await deleteAllInventoryColors(null, sourceItem.id);
        await deleteInventoryProductQuery(sourceItem.id, companyId);
      } else {
        // Reduce quantity and recalculate cost on the parent row.
        const newPricePerUnit = calculatePricePerUnit(
          newPurchasePrice,
          newQuantity,
          sourceItem.hst ?? 0,
        );
        await updateProduct(sourceItem.id, {
          quantity: newQuantity,
          purchasePrice: newPurchasePrice,
          pricePerUnit: newPricePerUnit,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAll(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.identifiersList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.identifierMapAll(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats(companyId) }),
      ]);
    },
    [companyId, queryClient, updateProduct],
  );

  const decreaseQuantity = useCallback(
    async (id: string, amount: number) => {
      // Read the current item from the cache at call time — avoids stale closure over inventory.
      const currentInventory =
        queryClient.getQueryData<InventoryItem[]>(queryKeys.inventoryAll(companyId)) ?? [];
      const item = currentInventory.find((i) => i.id === id);
      if (!item) throw new Error("Product not found");

      const newQuantity = Math.max(0, item.quantity - amount);

      let newPurchasePrice: number | null = null;
      if (item.purchasePrice != null && item.quantity > 0) {
        const costPerUnit = item.purchasePrice / item.quantity;
        newPurchasePrice = Math.round(costPerUnit * newQuantity * 100) / 100;
      }

      const updateData: InventoryUpdate = {
        quantity: newQuantity,
        last_updated: "Just now",
        updated_at: new Date().toISOString(),
        ...(newPurchasePrice !== null && { purchase_price: newPurchasePrice }),
      };

      await updateInventoryProductQuery(id, updateData, companyId ?? undefined);

      if (newQuantity === 0) {
        await deleteAllInventoryColors(null, id);
      }

      queryClient.setQueryData<InventoryItem[]>(queryKeys.inventoryAll(companyId), (old) =>
        (old ?? []).map((i) =>
          i.id === id
            ? {
                ...i,
                quantity: newQuantity,
                lastUpdated: "Just now",
                ...(newPurchasePrice !== null && { purchasePrice: newPurchasePrice }),
              }
            : i,
        ),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats(companyId) });
    },
    [companyId, queryClient],
  );

  const resetInventory = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAll(companyId) });
  }, [companyId, queryClient]);

  const refreshInventory = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAll(companyId) });
  }, [companyId, queryClient]);

  const bulkInsertProducts = useCallback(
    async (products: InventoryItem[]): Promise<BulkInsertResult> => {
      if (!user?.id) {
        throw new Error("User must be authenticated to upload products");
      }
      if (!companyId) {
        throw new Error("No active company context");
      }

      const result: BulkInsertResult = {
        success: 0,
        failed: 0,
        errors: [],
        insertedIds: [],
      };

      const batchSize = BULK_INSERT_BATCH_SIZE;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);

        try {
          const insertData = batch.map((p) => productToInsertRow(p, companyId));

          try {
            const data = await bulkInsertInventoryQuery(insertData);
            result.success += batch.length;
            for (const row of data as Array<{ id: string }>) {
              if (row?.id) result.insertedIds!.push(row.id);
            }
          } catch {
            for (const product of batch) {
              try {
                const singleData = await bulkInsertInventoryQuery([
                  productToInsertRow(product, companyId),
                ]);
                result.success++;
                if (singleData?.[0]?.id) {
                  result.insertedIds!.push(singleData[0].id as string);
                }
              } catch (individualError) {
                result.failed++;
                result.errors.push(
                  `${product.deviceName} ${product.storage}: ${
                    individualError instanceof Error ? individualError.message : "Unknown error"
                  }`,
                );
              }
            }
          }
        } catch (error) {
          result.failed += batch.length;
          result.errors.push(
            `Batch ${Math.floor(i / batchSize) + 1}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }
      }

      // Invalidate both the full list and any paginated pages so the UI reflects new products.
      await queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAll(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats(companyId) });
      return result;
    },
    [user?.id, companyId, queryClient],
  );

  const addInventoryIdentifier = useCallback(
    async (
      inventoryId: string,
      imei: string | null,
      serialNumber: string | null,
      color?: string | null,
      damageNote?: string | null,
      purchasePrice?: number | null,
    ): Promise<void> => {
      if (!companyId) throw new Error("No active company context");
      if (!imei && !serialNumber)
        throw new Error("At least one identifier (IMEI or serial number) is required");

      try {
        await insertInventoryIdentifierQuery({
          inventory_id: inventoryId,
          company_id: companyId,
          imei: imei ?? null,
          serial_number: serialNumber ?? null,
          status: "in_stock",
          ...(color ? { color } : {}),
          ...(damageNote ? { damage_note: damageNote } : {}),
          ...(purchasePrice != null ? { purchase_price: purchasePrice } : {}),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("[InventoryActions] addInventoryIdentifier failed:", error);
        // Unique constraint violation — this IMEI/serial already exists for this company.
        if (error.code === "23505") {
          const label = imei ?? serialNumber;
          throw new Error(
            `${label} is already registered in inventory. Each IMEI/serial must be unique — remove the duplicate and try again.`,
          );
        }
        throw new Error(error.message);
      }

      // Bust the damage-notes cache so the modal reflects the new unit.
      queryClient.invalidateQueries({ queryKey: queryKeys.damageNotes(inventoryId) });
    },
    [companyId, queryClient],
  );

  const lookupIdentifierForSale = useCallback(
    async (
      raw: string,
      options?: { allowSoldIdentifierIds?: readonly string[] },
    ): Promise<IdentifierSaleLookup | null> => {
      const q = raw.trim();
      if (!q || !companyId) return null;

      const allowSold = new Set(options?.allowSoldIdentifierIds ?? []);

      const row: Record<string, unknown> | null = await lookupIdentifierForSaleQuery(q, companyId);
      if (!row) return null;

      const status = String(row.status ?? "");
      const identifierId = String(row.id ?? "");

      if (status === "sold") {
        if (!allowSold.has(identifierId)) {
          throw new Error("This IMEI/serial has already been sold and is no longer available.");
        }
      } else if (status !== "in_stock" && status !== "reserved") {
        throw new Error(`This unit is not available for sale (status: ${status}).`);
      }

      const invRow = await fetchInventoryItemByIdQuery(row.inventory_id as string, companyId);
      if (!invRow) return null;

      const item = dbRowToInventoryItem(invRow);
      if (item.isActive === false) return null;

      const allowSoldQty = allowSold.has(identifierId);
      if (!allowSoldQty && item.quantity < 1) return null;

      return {
        identifierId,
        imei: (row.imei as string | null) ?? null,
        serialNumber: (row.serial_number as string | null) ?? null,
        status,
        color: (row.color as string | null) ?? null,
        damageNote: (row.damage_note as string | null) ?? null,
        item,
      };
    },
    [companyId],
  );

  const markInventoryIdentifierSold = useCallback(
    async (identifierId: string): Promise<void> => {
      if (!companyId) throw new Error("No active company context");
      const now = new Date().toISOString();
      const data = await markIdentifierSoldQuery(identifierId, companyId, now);
      if (!data) {
        throw new Error("That IMEI or serial is already sold or is not available.");
      }
    },
    [companyId],
  );

  const revertInventoryIdentifierSold = useCallback(
    async (identifierId: string): Promise<void> => {
      if (!companyId) return;
      const now = new Date().toISOString();
      await revertIdentifierSoldQuery(identifierId, companyId, now);
    },
    [companyId],
  );

  const getUploadHistory = useCallback(async (): Promise<UploadHistory[]> => {
    if (!companyId) return [];

    const data = await fetchUploadHistoryQuery(companyId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map((row: any) => ({
      id: row.id,
      uploadedBy: row.uploaded_by,
      fileName: row.file_name,
      totalProducts: row.total_products,
      successfulInserts: row.successful_inserts,
      failedInserts: row.failed_inserts,
      uploadStatus: row.upload_status as "pending" | "completed" | "failed",
      errorMessage: row.error_message ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }, [companyId]);

  return {
    updateProduct,
    updateInventoryIdentifier,
    updateIdentifierUnit,
    deleteIdentifierUnit,
    decreaseQuantity,
    resetInventory,
    refreshInventory,
    bulkInsertProducts,
    addInventoryIdentifier,
    lookupIdentifierForSale,
    markInventoryIdentifierSold,
    revertInventoryIdentifierSold,
    getUploadHistory,
  };
}
