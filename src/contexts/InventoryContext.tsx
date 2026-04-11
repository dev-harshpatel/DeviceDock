"use client";

import { InventoryItem } from "@/data/inventory";
import { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";
import { useCompany } from "@/contexts/CompanyContext";
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { ReactNode, createContext, useContext, useEffect, useState, useCallback } from "react";
import type { IdentifierSaleLookup } from "@/types/inventory-identifiers";
import { UploadHistory, BulkInsertResult } from "@/types/upload";
import { dbRowToInventoryItem, INVENTORY_ADMIN_FIELDS } from "@/lib/supabase/queries";
import { BULK_INSERT_BATCH_SIZE, INVENTORY_SORT_ORDER } from "@/lib/constants";

interface InventoryContextType {
  inventory: InventoryItem[];
  updateProduct: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
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
  ) => Promise<void>;
  /** Exact IMEI or serial match for manual sale (in_stock / reserved only). */
  lookupIdentifierForSale: (raw: string) => Promise<IdentifierSaleLookup | null>;
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
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { inventoryVersion } = useRealtimeContext();

  // Load inventory from Supabase — always use admin fields (admin-only app)
  const loadInventory = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data, error } = await (supabase.from("inventory") as any)
        .select(INVENTORY_ADMIN_FIELDS)
        .eq("company_id", companyId)
        .order("created_at", INVENTORY_SORT_ORDER.created_at)
        .order("id", INVENTORY_SORT_ORDER.id);

      if (error) {
        console.error("[InventoryContext] loadInventory error:", error.message, error);
        setInventory([]);
        return;
      }

      setInventory(data ? data.map(dbRowToInventoryItem) : []);
    } catch (err) {
      console.error("[InventoryContext] loadInventory exception:", err);
      setInventory([]);
    }
  }, [companyId]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setIsLoading(true);
      await loadInventory();
      if (isMounted) setIsLoading(false);
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [loadInventory]);

  // Reload inventory when RealtimeProvider signals inventory changes
  useEffect(() => {
    if (inventoryVersion > 0) {
      loadInventory();
    }
  }, [inventoryVersion, loadInventory]);

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

      setInventory((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updates, lastUpdated: "Just now" } : item,
        ),
      );
    },
    [companyId],
  );

  const decreaseQuantity = useCallback(
    async (id: string, amount: number) => {
      const item = inventory.find((i) => i.id === id);
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

      setInventory((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: newQuantity,
                lastUpdated: "Just now",
                ...(newPurchasePrice !== null && {
                  purchasePrice: newPurchasePrice,
                }),
              }
            : item,
        ),
      );
    },
    [inventory],
  );

  const resetInventory = useCallback(async () => {
    setIsLoading(true);
    await loadInventory();
    setIsLoading(false);
  }, [loadInventory]);

  const refreshInventory = useCallback(async () => {
    await loadInventory();
  }, [loadInventory]);

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

      await loadInventory();
      return result;
    },
    [user?.id, companyId, loadInventory],
  );

  const addInventoryIdentifier = useCallback(
    async (
      inventoryId: string,
      imei: string | null,
      serialNumber: string | null,
      color?: string | null,
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
    },
    [companyId],
  );

  const lookupIdentifierForSale = useCallback(
    async (raw: string): Promise<IdentifierSaleLookup | null> => {
      const q = raw.trim();
      if (!q || !companyId) return null;

      const fetchIdent = async (
        column: "imei" | "serial_number",
      ): Promise<Record<string, unknown> | null> => {
        const { data, error } = await (supabase.from("inventory_identifiers") as any)
          .select("id, inventory_id, imei, serial_number, status, color")
          .eq("company_id", companyId)
          .eq(column, q)
          .maybeSingle();
        if (error) {
          console.error("[InventoryContext] lookupIdentifierForSale:", error.message);
          return null;
        }
        return data ?? null;
      };

      let row = (await fetchIdent("imei")) ?? (await fetchIdent("serial_number"));
      if (!row) return null;

      const status = String(row.status ?? "");
      if (status === "sold") {
        throw new Error("This IMEI/serial has already been sold and is no longer available.");
      }
      if (status !== "in_stock" && status !== "reserved") {
        throw new Error(`This unit is not available for sale (status: ${status}).`);
      }

      const { data: invRow, error: invErr } = await (supabase.from("inventory") as any)
        .select(INVENTORY_ADMIN_FIELDS)
        .eq("id", row.inventory_id as string)
        .eq("company_id", companyId)
        .maybeSingle();

      if (invErr || !invRow) return null;

      const item = dbRowToInventoryItem(invRow);
      if (item.isActive === false || item.quantity < 1) return null;

      return {
        identifierId: row.id as string,
        imei: (row.imei as string | null) ?? null,
        serialNumber: (row.serial_number as string | null) ?? null,
        status,
        color: (row.color as string | null) ?? null,
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

  return (
    <InventoryContext.Provider
      value={{
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
        getUploadHistory,
        isLoading,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
};
