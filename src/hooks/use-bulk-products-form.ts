"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { calculatePricePerUnit } from "@/data/inventory";
import type { InventoryItem } from "@/data/inventory";
import type { Grade } from "@/lib/constants/grades";
import type { ColourRow } from "@/components/modals/ColourBreakdownDialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";
import {
  mergeInventoryColorsAdditive,
  replaceInventoryColors,
} from "@/lib/inventory/inventory-colors";
import { parseIdentifierList } from "@/lib/inventory/parse-identifier-list";
import { queryKeys } from "@/lib/query-keys";
import { createNotificationEvent } from "@/lib/notifications/client";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/types";
import { fetchColorSuggestionsByInventoryIdsQuery } from "@/lib/supabase/queries";
import type { BulkEditableField, BulkProductRowForm } from "@/types/bulk-products";

const MAX_ROWS = 50;

export const createEmptyRow = (): BulkProductRowForm => ({
  brand: "",
  deviceName: "",
  grade: "",
  hst: "13",
  imeiText: "",
  purchasePrice: "",
  quantity: "",
  selectedInventoryId: null,
  sellingPrice: "",
  serialText: "",
  storage: "",
  colorRows: [],
  colorMergeMode: false,
});

export const isRowEmpty = (row: BulkProductRowForm): boolean => {
  return (
    !row.deviceName.trim() &&
    !row.brand.trim() &&
    !row.grade &&
    !row.storage.trim() &&
    !row.imeiText.trim() &&
    !row.serialText.trim() &&
    !row.quantity.trim() &&
    !row.purchasePrice.trim() &&
    !row.hst.trim() &&
    !row.sellingPrice.trim()
  );
};

export const isRowComplete = (row: BulkProductRowForm): boolean => {
  const qty = Number(row.quantity) || 0;
  const pp = Number(row.purchasePrice) || 0;
  const sp = Number(row.sellingPrice) || 0;
  const hst = Number(row.hst) || 0;
  const imeis = parseIdentifierList(row.imeiText);
  const serials = parseIdentifierList(row.serialText);
  const totalIdentifiers = imeis.length + serials.length;
  return Boolean(
    row.deviceName.trim() &&
    row.brand.trim() &&
    row.grade &&
    row.storage.trim() &&
    totalIdentifiers > 0 &&
    totalIdentifiers === qty &&
    qty > 0 &&
    pp > 0 &&
    sp > 0 &&
    hst >= 0,
  );
};

export function useBulkProductsForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { companyId, slug } = useCompany();
  const { addInventoryIdentifier, bulkInsertProducts, inventory, updateProduct } = useInventory();

  const [rows, setRows] = useState<BulkProductRowForm[]>([createEmptyRow()]);
  const [lineCollapsed, setLineCollapsed] = useState<boolean[]>([false]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comboboxOpenIndex, setComboboxOpenIndex] = useState<number | null>(null);
  const [colorDialogState, setColorDialogState] = useState<{
    open: boolean;
    rowIndex: number | null;
    initialRows: ColourRow[];
    existingFullyAssigned: boolean;
    suggestedColors: string[];
  }>({
    open: false,
    rowIndex: null,
    initialRows: [],
    existingFullyAssigned: false,
    suggestedColors: [],
  });
  const [isLoadingColorRows, setIsLoadingColorRows] = useState(false);

  const inventoryPath = `/${slug}/inventory`;
  const productsPath = `/${slug}/products`;
  const uploadPath = `/${slug}/upload-products`;

  const handleCancel = useCallback(() => {
    router.push(inventoryPath);
  }, [inventoryPath, router]);

  useEffect(() => {
    setLineCollapsed((prev) => {
      if (prev.length === rows.length) return prev;
      const next = prev.slice(0, rows.length);
      while (next.length < rows.length) next.push(false);
      return next;
    });
  }, [rows.length]);

  const handleFieldChange = useCallback(
    (index: number, field: BulkEditableField, value: string) => {
      setRows((prev) =>
        prev.map((row, i) => {
          if (i !== index) return row;
          const clearsInventoryLink =
            field === "deviceName" || field === "brand" || field === "grade" || field === "storage";
          return {
            ...row,
            [field]: value,
            ...(clearsInventoryLink ? { selectedInventoryId: null } : {}),
          };
        }),
      );
    },
    [],
  );

  const handleSelectInventoryItem = useCallback((index: number, item: InventoryItem) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              deviceName: item.deviceName,
              brand: item.brand,
              grade: item.grade,
              storage: item.storage,
              hst: item.hst?.toString() ?? "13",
              sellingPrice: item.sellingPrice.toString(),
              quantity: "",
              imeiText: "",
              purchasePrice: "",
              serialText: "",
              selectedInventoryId: item.id,
              colorRows: [],
              colorMergeMode: false,
            }
          : row,
      ),
    );
    setComboboxOpenIndex(null);
  }, []);

  const handleClearInventoryRow = useCallback((index: number) => {
    setRows((prev) => prev.map((row, i) => (i === index ? createEmptyRow() : row)));
  }, []);

  const handleLineDone = useCallback((index: number) => {
    setLineCollapsed((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    setComboboxOpenIndex((prev) => (prev === index ? null : prev));
  }, []);

  const handleLineExpand = useCallback((index: number) => {
    setLineCollapsed((prev) => {
      const next = [...prev];
      next[index] = false;
      return next;
    });
  }, []);

  const handleAddRow = useCallback(() => {
    setRows((prev) => {
      if (prev.length >= MAX_ROWS) return prev;
      const last = prev[prev.length - 1];
      const nextRow = createEmptyRow();
      if (last && !isRowEmpty(last)) {
        nextRow.hst = last.hst || "13";
      }
      return [...prev, nextRow];
    });
  }, []);

  const handleRemoveRow = useCallback((index: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return [createEmptyRow()];
      return prev.filter((_, i) => i !== index);
    });
    setLineCollapsed((prev) => {
      if (prev.length <= 1) return [false];
      return prev.filter((_, i) => i !== index);
    });
    setComboboxOpenIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }, []);

  const mergeInventoryColors = useCallback(async (inventoryId: string, newRows: ColourRow[]) => {
    const mapped = newRows
      .filter((r) => r.color.trim() && Number(r.quantity) > 0)
      .map((r) => ({ color: r.color.trim(), quantity: Number(r.quantity) }));
    await mergeInventoryColorsAdditive(null, inventoryId, mapped);
  }, []);

  const saveInventoryColors = useCallback(async (inventoryId: string, rows: ColourRow[]) => {
    const mapped = rows
      .filter((row) => row.color.trim() && Number(row.quantity) > 0)
      .map((row) => ({ color: row.color.trim(), quantity: Number(row.quantity) }));
    await replaceInventoryColors(null, inventoryId, mapped);
  }, []);

  const openColorDialog = useCallback(
    async (rowIndex: number) => {
      const row = rows[rowIndex];
      if (!row) return;

      // Restocking an existing product — only assign colors for the new units
      if (row.selectedInventoryId) {
        setIsLoadingColorRows(true);
        setColorDialogState({
          open: true,
          rowIndex,
          initialRows: row.colorRows,
          existingFullyAssigned: true,
          suggestedColors: [],
        });
        try {
          const colors = await fetchColorSuggestionsByInventoryIdsQuery([row.selectedInventoryId]);
          setColorDialogState((prev) => ({ ...prev, suggestedColors: colors }));
        } catch {
          // Dropdown won't have suggestions — user can still type manually
        } finally {
          setIsLoadingColorRows(false);
        }
        return;
      }

      setColorDialogState({
        open: true,
        rowIndex,
        initialRows: row.colorRows,
        existingFullyAssigned: false,
        suggestedColors: [],
      });
    },
    [rows],
  );

  const handleColorDialogConfirm = useCallback(
    (colorRows: ColourRow[]) => {
      const rowIndex = colorDialogState.rowIndex;
      if (rowIndex === null) return;

      const mergeMode = colorDialogState.existingFullyAssigned;
      setRows((prev) =>
        prev.map((row, index) =>
          index === rowIndex ? { ...row, colorRows, colorMergeMode: mergeMode } : row,
        ),
      );
      setColorDialogState({
        open: false,
        rowIndex: null,
        initialRows: [],
        existingFullyAssigned: false,
        suggestedColors: [],
      });
    },
    [colorDialogState.rowIndex, colorDialogState.existingFullyAssigned],
  );

  const preparedRows = useMemo(() => rows.filter((r) => !isRowEmpty(r)), [rows]);

  const hasPartialRow = useMemo(
    () => rows.some((r) => !isRowEmpty(r) && !isRowComplete(r)),
    [rows],
  );

  const canSubmit = useMemo(
    () => preparedRows.length > 0 && !hasPartialRow && preparedRows.every(isRowComplete),
    [preparedRows, hasPartialRow],
  );

  const activeColorDialogRow =
    colorDialogState.rowIndex !== null ? (rows[colorDialogState.rowIndex] ?? null) : null;

  const activeColorDialogExisting =
    activeColorDialogRow?.selectedInventoryId != null
      ? (inventory.find((item) => item.id === activeColorDialogRow.selectedInventoryId) ?? null)
      : null;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return;

    const toProcess = rows.filter(isRowComplete);
    if (toProcess.length === 0) {
      toast.error("Add at least one complete product row.");
      return;
    }

    const partial = rows.some((r) => !isRowEmpty(r) && !isRowComplete(r));
    if (partial) {
      toast.error("Complete every row or clear unused rows.");
      return;
    }

    const allIdentifiers = new Set<string>();
    for (let i = 0; i < toProcess.length; i++) {
      const row = toProcess[i];
      const imeis = parseIdentifierList(row.imeiText);
      const serials = parseIdentifierList(row.serialText);
      const identifiers = [...imeis, ...serials];
      const qty = Number(row.quantity) || 0;
      if (identifiers.length !== qty) {
        toast.error(
          `Row ${i + 1}: identifiers count (${identifiers.length}) must match units (${qty}).`,
        );
        return;
      }
      const lowerSet = new Set<string>();
      for (const identifier of identifiers) {
        const key = identifier.toLowerCase();
        if (lowerSet.has(key)) {
          toast.error(`Row ${i + 1}: duplicate identifier "${identifier}".`);
          return;
        }
        lowerSet.add(key);
        if (allIdentifiers.has(key)) {
          toast.error(`Duplicate identifier across rows: "${identifier}".`);
          return;
        }
        allIdentifiers.add(key);
      }
    }

    setIsSubmitting(true);
    try {
      const restockRows = toProcess.filter((r) => r.selectedInventoryId);
      const newRows = toProcess.filter((r) => !r.selectedInventoryId);

      let restockOk = 0;
      let restockFail = 0;

      for (const row of restockRows) {
        const existingId = row.selectedInventoryId;
        if (!existingId) continue;
        const existing = inventory.find((i) => i.id === existingId);
        if (!existing) {
          restockFail++;
          continue;
        }

        const newQuantity = Number(row.quantity) || 0;
        const newPurchasePrice = Number(row.purchasePrice) || 0;
        const hstValue = Number(row.hst) || 0;
        const sellingPrice = Number(row.sellingPrice) || 0;
        const isOutOfStock = existing.quantity === 0;
        const totalQty = isOutOfStock ? newQuantity : existing.quantity + newQuantity;
        const totalPP = isOutOfStock
          ? newPurchasePrice
          : (existing.purchasePrice ?? 0) + newPurchasePrice;
        const avgPricePerUnit = calculatePricePerUnit(totalPP, totalQty, hstValue);

        try {
          await updateProduct(existing.id, {
            quantity: totalQty,
            purchasePrice: totalPP,
            pricePerUnit: avgPricePerUnit,
            sellingPrice,
            hst: hstValue || null,
          });

          const imeis = parseIdentifierList(row.imeiText);
          const serials = parseIdentifierList(row.serialText);
          for (const imei of imeis) {
            await addInventoryIdentifier(existing.id, imei, null);
          }
          for (const serial of serials) {
            await addInventoryIdentifier(existing.id, null, serial);
          }
          if (row.colorRows.length > 0) {
            if (row.colorMergeMode) {
              await mergeInventoryColors(existing.id, row.colorRows);
            } else {
              await saveInventoryColors(existing.id, row.colorRows);
            }
          }

          restockOk++;
        } catch {
          restockFail++;
        }
      }

      const inventoryItems: InventoryItem[] = newRows.map((row, index) => {
        const quantity = Number(row.quantity) || 0;
        const purchasePrice = Number(row.purchasePrice) || 0;
        const hstValue = Number(row.hst) || 0;
        const sellingPrice = Number(row.sellingPrice) || 0;
        const pricePerUnit = calculatePricePerUnit(purchasePrice, quantity, hstValue);
        return {
          id: `temp-${index}`,
          deviceName: row.deviceName.trim(),
          brand: row.brand.trim(),
          grade: row.grade as Grade,
          storage: row.storage.trim(),
          quantity,
          purchasePrice,
          hst: hstValue || null,
          pricePerUnit,
          sellingPrice,
          lastUpdated: "Just now",
          priceChange: "stable",
          isActive: true,
        };
      });

      const result =
        inventoryItems.length > 0
          ? await bulkInsertProducts(inventoryItems)
          : { success: 0, failed: 0, errors: [] as string[] };

      let newIdentifiersOk = 0;
      let newIdentifiersFail = 0;
      const insertedIds = result.insertedIds ?? [];
      for (let index = 0; index < insertedIds.length; index++) {
        const inventoryId = insertedIds[index];
        const sourceRow = newRows[index];
        if (!inventoryId || !sourceRow) continue;
        const imeis = parseIdentifierList(sourceRow.imeiText);
        const serials = parseIdentifierList(sourceRow.serialText);
        for (const imei of imeis) {
          try {
            await addInventoryIdentifier(inventoryId, imei, null);
            newIdentifiersOk++;
          } catch {
            newIdentifiersFail++;
          }
        }
        for (const serial of serials) {
          try {
            await addInventoryIdentifier(inventoryId, null, serial);
            newIdentifiersOk++;
          } catch {
            newIdentifiersFail++;
          }
        }

        if (sourceRow.colorRows.length > 0) {
          await saveInventoryColors(inventoryId, sourceRow.colorRows);
        }
      }

      if (inventoryItems.length > 0 && (result.failed > 0 || result.errors.length > 0)) {
        const detail =
          result.errors.length > 0
            ? result.errors.slice(0, 3).join(" . ")
            : `${result.failed} failed`;
        toast.error(`Some new products could not be added: ${detail}`);
      }

      if (newIdentifiersFail > 0) {
        toast.error(
          `${newIdentifiersFail} identifier${newIdentifiersFail !== 1 ? "s" : ""} could not be saved.`,
        );
      }

      if (restockFail > 0) {
        toast.error(
          `${restockFail} restock line${restockFail !== 1 ? "s" : ""} could not be saved (refresh and try again).`,
        );
      }

      const insertOk = result.success;
      const anySuccess = restockOk > 0 || insertOk > 0;
      if (anySuccess) {
        if (insertOk + restockOk > 0 && companyId) {
          const totalUnits = toProcess.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
          await createNotificationEvent({
            companyId,
            eventType: NOTIFICATION_EVENT_TYPES.inventoryProductAdded,
            message: `${insertOk} new product row${insertOk !== 1 ? "s" : ""} added and ${restockOk} row${restockOk !== 1 ? "s" : ""} restocked (${totalUnits} total units).`,
            metadata: {
              insertedRows: insertOk,
              restockedRows: restockOk,
              totalUnits,
            },
            title: "Bulk inventory update",
          });
        }
        const parts: string[] = [];
        if (restockOk > 0) parts.push(`${restockOk} restocked`);
        if (insertOk > 0) parts.push(`${insertOk} new product${insertOk !== 1 ? "s" : ""} added`);
        if (newIdentifiersOk > 0) {
          parts.push(`${newIdentifiersOk} identifier${newIdentifiersOk !== 1 ? "s" : ""} saved`);
        }
        toast.success(parts.join(" . "));
        await queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
        router.push(inventoryPath);
        return;
      }

      if (toProcess.length > 0) {
        toast.error("Nothing was saved. Check your rows and try again.");
      }
    } catch {
      toast.error("Failed to save products. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    bulkInsertProducts,
    canSubmit,
    inventory,
    inventoryPath,
    isSubmitting,
    queryClient,
    router,
    rows,
    saveInventoryColors,
    updateProduct,
    addInventoryIdentifier,
    mergeInventoryColors,
    companyId,
  ]);

  return {
    rows,
    setRows,
    lineCollapsed,
    setLineCollapsed,
    isSubmitting,
    comboboxOpenIndex,
    setComboboxOpenIndex,
    colorDialogState,
    setColorDialogState,
    isLoadingColorRows,
    inventoryPath,
    productsPath,
    uploadPath,
    handleCancel,
    handleFieldChange,
    handleSelectInventoryItem,
    handleClearInventoryRow,
    handleLineDone,
    handleLineExpand,
    handleAddRow,
    handleRemoveRow,
    openColorDialog,
    handleColorDialogConfirm,
    handleSubmit,
    canSubmit,
    hasPartialRow,
    activeColorDialogRow,
    activeColorDialogExisting,
    inventory,
  };
}
