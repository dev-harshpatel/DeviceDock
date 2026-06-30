"use client";

import { InventoryItem } from "@/data/inventory";
import { useCompany } from "@/contexts/CompanyContext";
import { ReactNode, createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { IdentifierFullLookup, IdentifierSaleLookup } from "@/types/inventory-identifiers";
import { UploadHistory, BulkInsertResult } from "@/types/upload";
import { fetchAllInventory } from "@/lib/supabase/queries";
import { groupMatchingInventoryItems } from "@/lib/inventory/group-inventory-items";
import type { Grade } from "@/lib/constants/grades";
import { useInventoryActions } from "@/hooks/use-inventory-actions";

interface InventoryContextType {
  inventory: InventoryItem[];
  /** Same items as `inventory` but with matching-spec rows merged into one grouped entry. */
  groupedInventory: InventoryItem[];
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
    damageNote?: string | null;
  }) => Promise<void>;
  /**
   * Permanently removes a single tracked unit (by IMEI / serial) from inventory.
   * Blocks if the unit is sold, reserved, or referenced by any order.
   * Recalculates the parent row's quantity, purchase price, and price/unit.
   * Deletes the parent row entirely if it reaches zero quantity.
   */
  deleteIdentifierUnit: (input: { lookup: IdentifierFullLookup }) => Promise<void>;
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
    purchasePrice?: number | null,
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

export const InventoryProvider = ({ children }: InventoryProviderProps) => {
  const { companyId } = useCompany();

  // All inventory for this company — replaces the old useState + useEffect + loadInventory.
  // Realtime invalidation is handled centrally by use-realtime-invalidation.ts in Providers.tsx.
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: queryKeys.inventoryAll(companyId),
    queryFn: () => fetchAllInventory(companyId),
    staleTime: 30_000,
    enabled: Boolean(companyId),
  });

  // Same-spec rows merged into single grouped entries for display (prices averaged by quantity).
  const groupedInventory = useMemo(() => groupMatchingInventoryItems(inventory), [inventory]);

  // Extract all mutation/lookup handlers into a separate, modular actions hook.
  const actions = useInventoryActions();

  const contextValue = useMemo(
    () => ({
      inventory,
      groupedInventory,
      isLoading,
      ...actions,
    }),
    [inventory, groupedInventory, isLoading, actions],
  );

  return <InventoryContext.Provider value={contextValue}>{children}</InventoryContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
};
