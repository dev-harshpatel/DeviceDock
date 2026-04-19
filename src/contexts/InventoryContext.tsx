"use client";

import { calculatePricePerUnit, InventoryItem } from "@/data/inventory";
import { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";
import { useCompany } from "@/contexts/CompanyContext";
import { ReactNode, createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { IdentifierFullLookup, IdentifierSaleLookup } from "@/types/inventory-identifiers";
import { UploadHistory, BulkInsertResult } from "@/types/upload";
import {
  dbRowToInventoryItem,
  fetchAllInventory,
  INVENTORY_ADMIN_FIELDS,
} from "@/lib/supabase/queries";
import { BULK_INSERT_BATCH_SIZE, INVENTORY_SORT_ORDER } from "@/lib/constants";
import {
  applyInventoryColorDelta,
  deleteAllInventoryColors,
} from "@/lib/inventory/inventory-colors";
import type { Grade } from "@/lib/constants/grades";
import { removeTax } from "@/lib/tax";

interface InventoryContextType {
  inventory: InventoryItem[];
  updateProduct: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  updateInventoryIdentifier: (
    identifierId: string,
    updates: { color?: string | null; damageNote?: string | null },
  ) => Promise<void>;
  updateIdentifierUnit: (input: {
    lookup: IdentifierFullLookup;
    color: string | null;
    grade: Grade;
    storage: string;
    pricePerUnit: number;
    sellingPrice: number;
    hst: number | null;
  }) => Promise<void>;
  decreaseQuantity: (id: string, amount: number) => Promise<void>;
  resetInventory: () => Promise<void>;
  refreshInventory: () => Promise<void>;
  bulkInsertProducts: (products: InventoryItem[]) => Promise<BulkInsertResult>;
  getUploadHistory: () => Promise<UploadHistory[]>;
  /**
   * Inserts a single unit record into inventory_identifiers.
   * Call this AFTER the parent inventory row exists (insert or restock).
   */
  addInventoryIdentifier: (
    inventoryId: string,
    imei: string | null,
    serialNumber: string | null,
    color?: string | null,
    damageNote?: string | null,
  ) => Promise<void>;
  /** Exact IMEI or serial match for manual sale (in_stock / reserved only). */
  lookupIdentifierForSale: (
    raw: string,
    options?: { allowSoldIdentifierIds?: readonly string[] },
  ) => Promise<IdentifierSaleLookup | null>;
  /** Marks a unit sold after the order is recorded; call before decreaseQuantity for that line. */
  markInventoryIdentifierSold: (identifierId: string) => Promise<void>;
  /** Restores identifier to in_stock if quantity decrease failed after mark (best-effort). */
  revertInventoryIdentifierSold: (identifierId: string) => Promise<void>;
  isLoading: boolean;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

interface InventoryProviderProps {
  children: ReactNode;
}

type InventoryUpdate = Database["public"]["Tables"]["inventory"]["Update"];

const toFiniteNumber = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
};

const roundCurrency = (value: number, precision = 4): number =>
  Math.round(value * 10 ** precision) / 10 ** precision;

const sameNumber = (a: number | null | undefined, b: number | null | undefined): boolean =>
  Math.abs((a ?? 0) - (b ?? 0)) < 0.0001;

const toInventoryUpdate = (updates: Partial<InventoryItem>): InventoryUpdate => {
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
  if (updates.isActive !== undefined) (updateData as any).is_active = updates.isActive;
  return updateData;
};

function productToInsertRow(product: InventoryItem, companyId: string) {
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
    // imei / serial_number intentionally omitted — individual units are
    // tracked in inventory_identifiers, not on the configuration row.
  };
}

export const InventoryProvider = ({ children }: InventoryProviderProps) => {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const queryClient = useQueryClient();

  // All inventory for this company — replaces the old useState + useEffect + loadInventory.
  // Realtime invalidation is handled centrally by use-realtime-invalidation.ts in Providers.tsx.
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: queryKeys.inventoryAll(companyId),
    queryFn: () => fetchAllInventory(companyId),
    staleTime: 30_000,
    enabled: Boolean(companyId),
  });

  const updateProduct = useCallback(
    async (id: string, updates: Partial<InventoryItem>) => {
      const updateData: InventoryUpdate = toInventoryUpdate({
        ...updates,
        lastUpdated: "Just now",
      });
      updateData.updated_at = new Date().toISOString();

      let query = (supabase.from("inventory") as any).update(updateData).eq("id", id);
      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { error } = await query;

      if (error) {
        console.error("[InventoryContext] updateProduct failed:", {
          code: error.code,
          details: error.details,
          hint: error.hint,
          id,
          message: error.message,
          updateData,
        });
        throw new Error(error.message || "Failed to update product");
      }

      if (updates.quantity === 0) {
        await deleteAllInventoryColors(supabase, id);
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

      const updateData: Record<string, string | null> = {};

      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.damageNote !== undefined) updateData.damage_note = updates.damageNote;

      if (Object.keys(updateData).length === 0) return;

      const { error } = await (supabase.from("inventory_identifiers") as any)
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", identifierId)
        .eq("company_id", companyId);

      if (error) {
        console.error("[InventoryContext] updateInventoryIdentifier failed:", {
          code: error.code,
          details: error.details,
          hint: error.hint,
          identifierId,
          message: error.message,
          updateData,
        });
        throw new Error(error.message || "Failed to update device details");
      }

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
    }): Promise<void> => {
      if (!companyId) {
        throw new Error("No active company context");
      }

      const { lookup, color, grade, storage, pricePerUnit, sellingPrice, hst } = input;
      const sourceItem = lookup.item;
      const sourceStatus = lookup.status;
      const normalizedColor = color?.trim() || null;
      const nextHst = hst ?? 0;
      const nextBasePurchase = roundCurrency(removeTax(pricePerUnit, nextHst));
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
        await updateInventoryIdentifier(lookup.identifierId, { color: normalizedColor });

        if (sourceColor !== normalizedColor) {
          await applyInventoryColorDelta(supabase, sourceItem.id, sourceColor, -1);
          await applyInventoryColorDelta(supabase, sourceItem.id, normalizedColor, 1);
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
      const sourceUnitBaseCost =
        sourceQuantity > 0 ? roundCurrency(sourcePurchasePrice / sourceQuantity) : 0;

      // Try to merge this device into an existing matching per-device row before creating one.
      const { data: candidateRows, error: candidateError } = await (
        supabase.from("inventory") as any
      )
        .select(INVENTORY_ADMIN_FIELDS)
        .eq("company_id", companyId)
        .eq("device_name", sourceItem.deviceName)
        .eq("brand", sourceItem.brand)
        .eq("grade", grade)
        .eq("storage", storage.trim())
        .eq("selling_price", sellingPrice)
        .eq("is_active", sourceItem.isActive ?? true)
        .eq("hst", nextHst)
        .gt("quantity", 0);

      if (candidateError) {
        throw new Error(candidateError.message || "Failed to find a matching inventory group");
      }

      const matchingTarget =
        ((candidateRows ?? []) as Array<Record<string, unknown>>)
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

          const { error: moveError } = await (supabase.from("inventory_identifiers") as any)
            .update({
              inventory_id: matchingTarget.id,
              color: normalizedColor,
              updated_at: nowIso,
            })
            .eq("id", lookup.identifierId)
            .eq("company_id", companyId);
          if (moveError) throw new Error(moveError.message || "Failed to move IMEI to target row");

          await applyInventoryColorDelta(supabase, sourceItem.id, sourceColor, -1);
          await applyInventoryColorDelta(supabase, matchingTarget.id, normalizedColor, 1);

          const { error: deleteSourceError } = await (supabase.from("inventory") as any)
            .delete()
            .eq("id", sourceItem.id)
            .eq("company_id", companyId);
          if (deleteSourceError) {
            throw new Error(deleteSourceError.message || "Failed to remove old inventory group");
          }

          await deleteAllInventoryColors(supabase, sourceItem.id);
        } else {
          await updateProduct(sourceItem.id, {
            grade,
            storage: storage.trim(),
            purchasePrice: nextBasePurchase,
            pricePerUnit: nextStoredPricePerUnit,
            sellingPrice,
            hst: nextHst,
          });

          await updateInventoryIdentifier(lookup.identifierId, { color: normalizedColor });

          if (sourceColor !== normalizedColor) {
            await applyInventoryColorDelta(supabase, sourceItem.id, sourceColor, -1);
            await applyInventoryColorDelta(supabase, sourceItem.id, normalizedColor, 1);
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
          const { data: insertedRow, error: insertError } = await (
            supabase.from("inventory") as any
          )
            .insert({
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
            })
            .select(INVENTORY_ADMIN_FIELDS)
            .single();
          if (insertError || !insertedRow) {
            throw new Error(insertError?.message || "Failed to create a split inventory row");
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

        const { error: moveError } = await (supabase.from("inventory_identifiers") as any)
          .update({
            inventory_id: targetInventoryId,
            color: normalizedColor,
            updated_at: nowIso,
          })
          .eq("id", lookup.identifierId)
          .eq("company_id", companyId);
        if (moveError) throw new Error(moveError.message || "Failed to move IMEI to a new group");

        await applyInventoryColorDelta(supabase, sourceItem.id, sourceColor, -1);
        await applyInventoryColorDelta(supabase, targetInventoryId, normalizedColor, 1);
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

      const { error } = await (supabase.from("inventory") as any).update(updateData).eq("id", id);

      if (error) throw error;

      if (newQuantity === 0) {
        await deleteAllInventoryColors(supabase, id);
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

          const { data, error } = await (supabase.from("inventory") as any)
            .insert(insertData)
            .select();

          if (error) {
            for (const product of batch) {
              try {
                const { data: individualData, error: individualError } = await (
                  supabase.from("inventory") as any
                )
                  .insert(productToInsertRow(product, companyId))
                  .select("id");

                if (individualError) {
                  result.failed++;
                  result.errors.push(
                    `${product.deviceName} ${product.storage}: ${individualError.message}`,
                  );
                } else {
                  result.success++;
                  if (individualData?.[0]?.id) {
                    result.insertedIds!.push(individualData[0].id as string);
                  }
                }
              } catch (err) {
                result.failed++;
                result.errors.push(
                  `${product.deviceName} ${product.storage}: ${
                    err instanceof Error ? err.message : "Unknown error"
                  }`,
                );
              }
            }
          } else {
            result.success += batch.length;
            if (data) {
              for (const row of data as Array<{ id: string }>) {
                if (row?.id) result.insertedIds!.push(row.id);
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
    ): Promise<void> => {
      if (!companyId) throw new Error("No active company context");
      if (!imei && !serialNumber)
        throw new Error("At least one identifier (IMEI or serial number) is required");

      const { error } = await (supabase.from("inventory_identifiers") as any).insert({
        inventory_id: inventoryId,
        company_id: companyId,
        imei: imei ?? null,
        serial_number: serialNumber ?? null,
        status: "in_stock",
        ...(color ? { color } : {}),
        ...(damageNote ? { damage_note: damageNote } : {}),
      });

      if (error) {
        console.error("[InventoryContext] addInventoryIdentifier failed:", error);
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

      const fetchIdent = async (
        column: "imei" | "serial_number",
      ): Promise<Record<string, unknown> | null> => {
        const { data, error } = await (supabase.from("inventory_identifiers") as any)
          .select("id, inventory_id, imei, serial_number, status, color, damage_note")
          .eq("company_id", companyId)
          .eq(column, q)
          .maybeSingle();
        if (error) {
          console.error("[InventoryContext] lookupIdentifierForSale:", error.message);
          return null;
        }
        return data ?? null;
      };

      const row = (await fetchIdent("imei")) ?? (await fetchIdent("serial_number"));
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

      const { data: invRow, error: invErr } = await (supabase.from("inventory") as any)
        .select(INVENTORY_ADMIN_FIELDS)
        .eq("id", row.inventory_id as string)
        .eq("company_id", companyId)
        .maybeSingle();

      if (invErr || !invRow) return null;

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
        throw new Error(error.message || "Failed to mark identifier as sold");
      }
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
      await (supabase.from("inventory_identifiers") as any)
        .update({
          status: "in_stock",
          sold_at: null,
          updated_at: now,
        })
        .eq("id", identifierId)
        .eq("company_id", companyId)
        .eq("status", "sold");
    },
    [companyId],
  );

  const getUploadHistory = useCallback(async (): Promise<UploadHistory[]> => {
    if (!companyId) return [];

    const { data, error } = await (supabase.from("product_uploads") as any)
      .select(
        [
          "id",
          "uploaded_by",
          "file_name",
          "total_products",
          "successful_inserts",
          "failed_inserts",
          "upload_status",
          "error_message",
          "created_at",
          "updated_at",
        ].join(", "),
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[InventoryContext] getUploadHistory error:", error.message, error);
      throw error;
    }
    if (!data) return [];

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

  const contextValue = useMemo(
    () => ({
      inventory,
      updateProduct,
      decreaseQuantity,
      resetInventory,
      refreshInventory,
      bulkInsertProducts,
      addInventoryIdentifier,
      lookupIdentifierForSale,
      markInventoryIdentifierSold,
      revertInventoryIdentifierSold,
      updateIdentifierUnit,
      updateInventoryIdentifier,
      getUploadHistory,
      isLoading,
    }),
    [
      inventory,
      isLoading,
      updateProduct,
      decreaseQuantity,
      resetInventory,
      refreshInventory,
      bulkInsertProducts,
      addInventoryIdentifier,
      lookupIdentifierForSale,
      markInventoryIdentifierSold,
      revertInventoryIdentifierSold,
      updateIdentifierUnit,
      updateInventoryIdentifier,
      getUploadHistory,
    ],
  );

  return <InventoryContext.Provider value={contextValue}>{children}</InventoryContext.Provider>;
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
};
