"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Info,
  Layers,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { calculatePricePerUnit } from "@/data/inventory";
import type { InventoryItem } from "@/data/inventory";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { ColourBreakdownDialog, type ColourRow } from "@/components/modals/ColourBreakdownDialog";
import { supabase } from "@/lib/supabase/client";
import { type Grade, GRADES, GRADE_BADGE_LABELS, GRADE_LABELS } from "@/lib/constants/grades";
import { cn, formatPrice } from "@/lib/utils";
import { normalizeStorage, storageInputDisplay } from "@/lib/utils/storage";

const MAX_ROWS = 50;

interface BulkProductRowForm {
  brand: string;
  deviceName: string;
  grade: Grade | "";
  hst: string;
  imeiText: string;
  purchasePrice: string;
  quantity: string;
  selectedInventoryId: string | null;
  sellingPrice: string;
  serialText: string;
  storage: string;
  colorRows: ColourRow[];
  colorMergeMode: boolean;
}

type BulkEditableField = keyof Omit<BulkProductRowForm, "selectedInventoryId">;

const createEmptyRow = (): BulkProductRowForm => ({
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

const GRADE_STYLES: Record<string, string> = {
  "Brand New Open Box": "bg-teal-500/10 text-teal-700 border-teal-500/30",
  "Brand New Sealed": "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  D: "bg-red-500/10 text-red-700 border-red-500/30",
};

const isRowEmpty = (row: BulkProductRowForm): boolean => {
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

const averageUnitPriceExclHst = (totalPurchase: number, quantity: number): number => {
  if (quantity <= 0) return 0;
  return Math.round((totalPurchase / quantity) * 100) / 100;
};

const isRowComplete = (row: BulkProductRowForm): boolean => {
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

interface BulkRowPricePreviewProps {
  existingItem: InventoryItem | null;
  row: BulkProductRowForm;
}

const BulkRowPricePreview = ({ existingItem, row }: BulkRowPricePreviewProps) => {
  const newQty = Number(row.quantity) || 0;
  const newPP = Number(row.purchasePrice) || 0;
  const hstValue = Number(row.hst) || 0;
  const sellingPrice = Number(row.sellingPrice) || 0;

  const mergePreview = useMemo(() => {
    if (!existingItem || newQty <= 0 || newPP <= 0) return null;
    const isOutOfStock = existingItem.quantity === 0;
    const totalQty = isOutOfStock ? newQty : existingItem.quantity + newQty;
    const totalPP = isOutOfStock ? newPP : (existingItem.purchasePrice ?? 0) + newPP;
    const avgPricePerUnitInclHst = calculatePricePerUnit(totalPP, totalQty, hstValue);
    const avgPricePerUnitExclHst = averageUnitPriceExclHst(totalPP, totalQty);
    return {
      avgPricePerUnitExclHst,
      avgPricePerUnitInclHst,
      isOutOfStock,
      totalPP,
      totalQty,
    };
  }, [existingItem, hstValue, newPP, newQty]);

  const newLinePreview = useMemo(() => {
    if (row.selectedInventoryId || existingItem || newQty <= 0 || newPP <= 0) {
      return null;
    }
    const avgPricePerUnitInclHst = calculatePricePerUnit(newPP, newQty, hstValue);
    const avgPricePerUnitExclHst = averageUnitPriceExclHst(newPP, newQty);
    return {
      avgPricePerUnitExclHst,
      avgPricePerUnitInclHst,
      totalPP: newPP,
      totalQty: newQty,
    };
  }, [existingItem, hstValue, newPP, newQty, row.selectedInventoryId]);

  if (mergePreview && existingItem) {
    return (
      <div className="rounded-lg border border-border overflow-hidden bg-muted/5">
        <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {mergePreview.isOutOfStock ? "Fresh batch" : "Merge preview"}
          </p>
          {mergePreview.isOutOfStock ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium text-right">
              Was out of stock - prior cost not carried
            </span>
          ) : null}
        </div>

        <div className="space-y-2 px-3 py-2.5 bg-muted/30 border-t border-border">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Avg. price / unit (excl. HST)
            </span>
            <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
              {formatPrice(mergePreview.avgPricePerUnitExclHst)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground min-w-0 pl-5">
              {mergePreview.isOutOfStock
                ? "Price / unit (incl. HST)"
                : "Avg. price / unit (incl. HST)"}
            </span>
            <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
              {formatPrice(mergePreview.avgPricePerUnitInclHst)}
            </span>
          </div>
        </div>
        {sellingPrice > 0 ? (
          <p className="px-3 pb-2 text-[11px] text-muted-foreground">
            Sell {formatPrice(sellingPrice)} / unit - Margin vs landed cost:{" "}
            <span
              className={cn(
                "font-medium tabular-nums",
                sellingPrice - mergePreview.avgPricePerUnitInclHst >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive",
              )}
            >
              {formatPrice(sellingPrice - mergePreview.avgPricePerUnitInclHst)}
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  if (newLinePreview) {
    return (
      <div className="rounded-lg border border-border overflow-hidden bg-muted/5">
        <div className="space-y-2 px-3 py-2.5 bg-muted/30 border-t border-border">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Avg. price / unit (excl. HST)
            </span>
            <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
              {formatPrice(newLinePreview.avgPricePerUnitExclHst)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground min-w-0 pl-5">
              Price / unit (incl. HST)
            </span>
            <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
              {formatPrice(newLinePreview.avgPricePerUnitInclHst)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4 text-center">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Enter quantity and total purchase price to see average cost per unit (excl. HST) and landed
        cost per unit (incl. HST).
      </p>
    </div>
  );
};

export default function AddMultipleProducts() {
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
    await mergeInventoryColorsAdditive(supabase, inventoryId, mapped);
  }, []);

  const saveInventoryColors = useCallback(async (inventoryId: string, rows: ColourRow[]) => {
    const mapped = rows
      .filter((row) => row.color.trim() && Number(row.quantity) > 0)
      .map((row) => ({ color: row.color.trim(), quantity: Number(row.quantity) }));
    await replaceInventoryColors(supabase, inventoryId, mapped);
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
          const { data, error } = await (supabase as any)
            .from("inventory_colors")
            .select("color")
            .eq("inventory_id", row.selectedInventoryId)
            .order("color");
          if (!error && data) {
            const colors = (data as { color: string }[]).map((d) => d.color);
            setColorDialogState((prev) => ({ ...prev, suggestedColors: colors }));
          }
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
    [rows, inventory],
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
  ]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <header className="shrink-0 border-b border-border bg-background px-4 sm:px-6 lg:px-10 xl:px-12 py-2.5 sm:py-3">
        <div className="w-full max-w-[1920px] mx-auto flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            className="w-fit -ml-2 gap-2 h-9 px-2 text-muted-foreground hover:text-foreground"
            onClick={handleCancel}
            disabled={isSubmitting}
            aria-label="Back to inventory"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back to inventory
          </Button>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Layers className="h-4 w-4 text-primary" />
              </span>
              Add multiple products
            </h1>
            <p className="text-sm text-muted-foreground max-w-4xl leading-relaxed">
              Add several new SKUs in one go. Colour breakdown can be set later in{" "}
              <Link
                href={productsPath}
                className="text-primary underline underline-offset-2 font-medium"
              >
                Product Management
              </Link>
              .{" "}
              <Link
                href={uploadPath}
                className="text-primary underline underline-offset-2 font-medium"
              >
                Import from spreadsheet
              </Link>{" "}
              for large lists.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 py-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
              Up to {MAX_ROWS} lines. Tap Done on a line to collapse it and save space, then Add row
              for the next SKU. Purchase price is the batch total; previews show landed cost and
              margin.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0 self-start sm:self-center"
              onClick={handleAddRow}
              disabled={rows.length >= MAX_ROWS || isSubmitting}
              aria-label="Add another product row"
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </div>

          {hasPartialRow ? (
            <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
              Finish all fields on each non-empty row, or clear unused rows.
            </p>
          ) : null}

          <div className="space-y-2.5">
            {rows.map((row, index) => {
              const existingItem =
                row.selectedInventoryId != null
                  ? (inventory.find((i) => i.id === row.selectedInventoryId) ?? null)
                  : null;
              const isCollapsed = lineCollapsed[index] ?? false;

              if (isCollapsed) {
                const qty = Number(row.quantity) || 0;
                const pp = Number(row.purchasePrice) || 0;
                const sp = Number(row.sellingPrice) || 0;
                const hst = Number(row.hst) || 0;
                const specParts = [row.brand.trim(), row.grade, row.storage.trim()]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <article
                    key={index}
                    className="rounded-lg border border-border bg-muted/20 shadow-sm"
                  >
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between px-3 py-2 sm:py-2.5 gap-2">
                      <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                        <span
                          className="text-sm font-semibold tabular-nums text-foreground shrink-0 min-w-[1.75ch]"
                          aria-label={`Item ${index + 1}`}
                        >
                          {index + 1}.
                        </span>
                        <span className="font-medium text-foreground truncate max-w-[min(100vw-8rem,320px)] sm:max-w-md">
                          {row.deviceName.trim() || "-"}
                        </span>
                        {specParts ? (
                          <span className="text-muted-foreground text-xs sm:text-sm">
                            {specParts}
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Qty {qty > 0 ? qty : "-"} · Purchase {pp > 0 ? formatPrice(pp) : "-"} ·
                          Sell {sp > 0 ? formatPrice(sp) : "-"}
                          {hst ? ` · HST ${hst}%` : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => handleLineExpand(index)}
                          disabled={isSubmitting}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveRow(index)}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              }

              return (
                <article
                  key={index}
                  className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-stretch lg:gap-4 xl:gap-6">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                        <span className="text-base font-semibold tabular-nums text-foreground">
                          {index + 1}.
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => handleLineDone(index)}
                            disabled={isSubmitting}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Done
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveRow(index)}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label
                          className="text-sm font-medium"
                          htmlFor={`bulk-device-search-${index}`}
                        >
                          Product
                        </Label>
                        <Popover
                          open={comboboxOpenIndex === index}
                          onOpenChange={(popoverOpen) => {
                            if (popoverOpen) {
                              setComboboxOpenIndex(index);
                              return;
                            }
                            setComboboxOpenIndex((prev) => (prev === index ? null : prev));
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              id={`bulk-device-search-${index}`}
                              aria-expanded={comboboxOpenIndex === index}
                              disabled={isSubmitting}
                              className="h-10 w-full min-w-0 justify-between font-normal whitespace-normal text-left"
                            >
                              <span
                                className={cn(
                                  "line-clamp-2 text-sm text-left",
                                  !row.deviceName && "text-muted-foreground",
                                )}
                              >
                                {row.deviceName ? row.deviceName : "Search inventory..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[var(--radix-popover-trigger-width)] p-0"
                            align="start"
                            side="bottom"
                          >
                            <Command>
                              <CommandInput placeholder="Type to filter..." className="h-9" />
                              <CommandList className="max-h-60">
                                <CommandEmpty>
                                  <div className="py-4 text-center space-y-1">
                                    <p className="text-sm font-medium text-foreground">
                                      No match found
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Fill in the device name below to add a new product.
                                    </p>
                                  </div>
                                </CommandEmpty>
                                <CommandGroup heading={`${inventory.length} products in inventory`}>
                                  {inventory.map((item) => (
                                    <CommandItem
                                      key={item.id}
                                      value={`${item.deviceName} ${item.grade} ${item.storage} ${item.brand}`}
                                      onSelect={() => handleSelectInventoryItem(index, item)}
                                      className="py-2 cursor-pointer"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0 text-primary",
                                          row.selectedInventoryId === item.id
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      <div className="flex flex-1 items-center justify-between min-w-0 gap-3">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium truncate leading-tight">
                                            {item.deviceName}
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {item.storage} · Qty:{" "}
                                            <strong className="text-foreground">
                                              {item.quantity}
                                            </strong>{" "}
                                            · {formatPrice(item.sellingPrice)}
                                          </p>
                                        </div>
                                        <span
                                          className={cn(
                                            "shrink-0 inline-flex items-center justify-center text-xs font-bold px-1.5 py-0.5 min-w-[1.5rem] rounded border",
                                            GRADE_STYLES[item.grade],
                                          )}
                                        >
                                          {GRADE_BADGE_LABELS[item.grade as Grade]}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Device name — editable when adding a new (non-inventory) product */}
                      {!row.selectedInventoryId && (
                        <div className="space-y-1.5">
                          <Label
                            className="text-sm font-medium"
                            htmlFor={`bulk-device-name-${index}`}
                          >
                            Device name
                          </Label>
                          <Input
                            id={`bulk-device-name-${index}`}
                            placeholder="e.g. iPhone 14 Pro"
                            value={row.deviceName}
                            onChange={(event) =>
                              handleFieldChange(index, "deviceName", event.target.value)
                            }
                            disabled={isSubmitting}
                            className="h-10"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Brand</Label>
                          <Input
                            placeholder="Brand"
                            value={row.brand}
                            onChange={(event) =>
                              handleFieldChange(index, "brand", event.target.value)
                            }
                            disabled={isSubmitting || !!row.selectedInventoryId}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Grade</Label>
                          <Select
                            value={row.grade === "" ? undefined : row.grade}
                            onValueChange={(value) => handleFieldChange(index, "grade", value)}
                            disabled={isSubmitting || !!row.selectedInventoryId}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Grade" />
                            </SelectTrigger>
                            <SelectContent>
                              {GRADES.map((gradeValue) => (
                                <SelectItem key={gradeValue} value={gradeValue}>
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "inline-flex items-center justify-center rounded text-xs font-bold border px-1.5 py-0.5 min-w-[1.5rem]",
                                        GRADE_STYLES[gradeValue],
                                      )}
                                    >
                                      {GRADE_BADGE_LABELS[gradeValue]}
                                    </span>
                                    {GRADE_LABELS[gradeValue]}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Storage</Label>
                          <div className="relative">
                            <Input
                              placeholder="128"
                              value={storageInputDisplay(row.storage)}
                              onChange={(event) =>
                                handleFieldChange(
                                  index,
                                  "storage",
                                  normalizeStorage(event.target.value),
                                )
                              }
                              disabled={isSubmitting || !!row.selectedInventoryId}
                              className="h-10 pr-10"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                              GB
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">
                            {row.selectedInventoryId ? "Units to add" : "Quantity"}
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="0"
                            value={row.quantity}
                            onChange={(event) =>
                              handleFieldChange(index, "quantity", event.target.value)
                            }
                            disabled={isSubmitting}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">HST %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="13"
                            value={row.hst}
                            onChange={(event) =>
                              handleFieldChange(index, "hst", event.target.value)
                            }
                            disabled={isSubmitting}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Total purchase $</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0"
                            value={row.purchasePrice}
                            onChange={(event) =>
                              handleFieldChange(index, "purchasePrice", event.target.value)
                            }
                            disabled={isSubmitting}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Sell / unit $</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0"
                            value={row.sellingPrice}
                            onChange={(event) =>
                              handleFieldChange(index, "sellingPrice", event.target.value)
                            }
                            disabled={isSubmitting}
                            className="h-10"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Colours assigned:{" "}
                          {row.colorRows.reduce(
                            (sum, colorRow) => sum + (Number(colorRow.quantity) || 0),
                            0,
                          )}{" "}
                          / {Number(row.quantity) || 0}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => openColorDialog(index)}
                          disabled={isSubmitting || isLoadingColorRows}
                        >
                          <Palette className="h-3.5 w-3.5" />
                          Assign colors
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium" htmlFor={`bulk-imei-${index}`}>
                          IMEI numbers (comma-separated)
                        </Label>
                        <Textarea
                          id={`bulk-imei-${index}`}
                          placeholder={
                            "Paste IMEIs separated by commas\nExample: 357890123456789, 357890123456790"
                          }
                          value={row.imeiText}
                          onChange={(event) =>
                            handleFieldChange(index, "imeiText", event.target.value)
                          }
                          disabled={isSubmitting}
                          className="min-h-[90px] resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium" htmlFor={`bulk-serial-${index}`}>
                          Serial numbers (comma-separated)
                        </Label>
                        <Textarea
                          id={`bulk-serial-${index}`}
                          placeholder={
                            "Paste serials separated by commas\nExample: SN-ABC-12345, SN-XYZ-99211"
                          }
                          value={row.serialText}
                          onChange={(event) =>
                            handleFieldChange(index, "serialText", event.target.value)
                          }
                          disabled={isSubmitting}
                          className="min-h-[90px] resize-y"
                        />
                        <p className="text-xs text-muted-foreground">
                          Use commas between identifiers (new lines also work). IMEI{" "}
                          {parseIdentifierList(row.imeiText).length} | Serial{" "}
                          {parseIdentifierList(row.serialText).length} | Total{" "}
                          {parseIdentifierList(row.imeiText).length +
                            parseIdentifierList(row.serialText).length}{" "}
                          / Required {Number(row.quantity) || 0}
                        </p>
                      </div>
                    </div>

                    <div className="lg:w-[min(100%,380px)] xl:w-[420px] shrink-0 lg:border-l lg:border-border lg:pl-4 xl:pl-6 space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Pricing preview
                      </p>
                      <BulkRowPricePreview row={row} existingItem={existingItem} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-background px-4 sm:px-6 lg:px-10 xl:px-12 py-2.5 sm:py-3">
        <div className="w-full max-w-[1920px] mx-auto flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="gap-2 min-w-[10rem]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Add to inventory"
            )}
          </Button>
        </div>
      </footer>

      <ColourBreakdownDialog
        open={colorDialogState.open}
        onOpenChange={(open) => {
          if (open) return;
          setColorDialogState({
            open: false,
            rowIndex: null,
            initialRows: [],
            existingFullyAssigned: false,
            suggestedColors: [],
          });
        }}
        productName={activeColorDialogRow?.deviceName || "this product"}
        totalQuantity={
          activeColorDialogRow
            ? colorDialogState.existingFullyAssigned
              ? Number(activeColorDialogRow.quantity) || 0
              : (activeColorDialogExisting?.quantity ?? 0) +
                (Number(activeColorDialogRow.quantity) || 0)
            : 0
        }
        initialColors={colorDialogState.initialRows}
        suggestedColors={colorDialogState.suggestedColors}
        isLoadingInitialColors={isLoadingColorRows}
        onConfirm={handleColorDialogConfirm}
        confirmLabel="Save colours"
      />
    </div>
  );
}
