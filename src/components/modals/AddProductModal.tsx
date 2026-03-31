"use client";

import { KeyboardEvent, useState, useMemo, useCallback, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, Loader2, Package, Info, Palette } from "lucide-react";
import { ColourBreakdownDialog, type ColourRow } from "@/components/modals/ColourBreakdownDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { calculatePricePerUnit } from "@/data/inventory";
import type { InventoryItem } from "@/data/inventory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useInventory } from "@/contexts/InventoryContext";
import { useAuth } from "@/lib/auth/context";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/lib/supabase/client";
import { type Grade, GRADES, GRADE_BADGE_LABELS, GRADE_LABELS } from "@/lib/constants/grades";

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pre-select an existing inventory item (e.g. from Demand page restock flow) */
  initialItemId?: string;
  /** Called after a successful restock of an existing item */
  onRestockComplete?: (itemId: string) => void;
}

interface ProductForm {
  deviceName: string;
  brand: string;
  grade: Grade | "";
  storage: string;
  quantity: string;
  purchasePrice: string;
  hst: string;
  sellingPrice: string;
  imei: string;
  serialNumber: string;
}

type BulkRowStatus = "pending" | "valid" | "invalid";

interface BulkScanRow {
  id: string;
  identifier: string;
  imei: string | null;
  serialNumber: string | null;
  status: BulkRowStatus;
  reason?: string;
}

const defaultForm: ProductForm = {
  deviceName: "",
  brand: "",
  grade: "",
  storage: "",
  quantity: "",
  purchasePrice: "",
  hst: "13",
  sellingPrice: "",
  imei: "",
  serialNumber: "",
};

const GRADE_STYLES: Record<string, string> = {
  "Brand New Sealed": "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  "Brand New Open Box": "bg-teal-500/10 text-teal-700 border-teal-500/30",
  A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  D: "bg-red-500/10 text-red-700 border-red-500/30",
};

export function AddProductModal({
  open,
  onOpenChange,
  onSuccess,
  initialItemId,
  onRestockComplete,
}: AddProductModalProps) {
  const { inventory, updateProduct, bulkInsertProducts, addInventoryIdentifier } = useInventory();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colourDialogOpen, setColourDialogOpen] = useState(false);
  const [existingColorRows, setExistingColorRows] = useState<ColourRow[]>([]);
  const [isLoadingExistingColors, setIsLoadingExistingColors] = useState(false);
  const [suggestedColors, setSuggestedColors] = useState<string[]>([]);

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [step, setStep] = useState<"form" | "review">("form");
  const [bulkRows, setBulkRows] = useState<BulkScanRow[]>([]);
  const [bulkScanInput, setBulkScanInput] = useState("");
  const [isBulkReviewing, setIsBulkReviewing] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);
  const hasIdentifier = Boolean(form.imei?.trim() || form.serialNumber?.trim());

  // Fetch all unique colors used by same device type (brand + deviceName) for suggestions
  useEffect(() => {
    if (!colourDialogOpen || !form.brand.trim() || !form.deviceName.trim()) {
      setSuggestedColors([]);
      return;
    }

    const sameDeviceIds = inventory
      .filter((i) => i.brand === form.brand && i.deviceName === form.deviceName)
      .map((i) => i.id);

    if (sameDeviceIds.length === 0) {
      setSuggestedColors([]);
      return;
    }

    (supabase as any)
      .from("inventory_colors")
      .select("color")
      .in("inventory_id", sameDeviceIds)
      .then(({ data }: { data: Array<{ color: string }> | null }) => {
        const unique = [...new Set((data ?? []).map((r) => r.color))].sort();
        setSuggestedColors(unique);
      })
      .catch(() => setSuggestedColors([]));
  }, [colourDialogOpen, form.brand, form.deviceName, inventory]);

  // When adding a unit to an existing device (any case), pre-load its colour breakdown
  // so the dialog shows the full picture and a full replace is applied on save.
  useEffect(() => {
    if (!colourDialogOpen || !selectedExistingId) {
      setIsLoadingExistingColors(false);
      return;
    }

    setIsLoadingExistingColors(true);
    (supabase as any)
      .from("inventory_colors")
      .select("color, quantity")
      .eq("inventory_id", selectedExistingId)
      .order("color")
      .then(({ data }: { data: Array<{ color: string; quantity: number }> | null }) => {
        setExistingColorRows(
          (data ?? []).map((r) => ({ color: r.color, quantity: String(r.quantity) })),
        );
      })
      .catch((error: unknown) => {
        console.error("Failed to load existing colors:", error);
      })
      .finally(() => {
        setIsLoadingExistingColors(false);
      });
  }, [colourDialogOpen, selectedExistingId]);

  // Pre-select item when initialItemId is provided (e.g. from Demand restock flow)
  useEffect(() => {
    if (open && initialItemId) {
      const item = inventory.find((i) => i.id === initialItemId);
      if (item) {
        handleSelectExisting(item);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItemId]);

  const selectedExisting = useMemo(
    () =>
      selectedExistingId ? (inventory.find((i) => i.id === selectedExistingId) ?? null) : null,
    [inventory, selectedExistingId],
  );

  const isLegacyRestock = Boolean(selectedExisting && !hasIdentifier);
  const newQuantity = hasIdentifier ? 1 : Number(form.quantity) || 0;
  const newPurchasePrice = Number(form.purchasePrice) || 0;
  const hstValue = Number(form.hst) || 0;
  const sellingPrice = Number(form.sellingPrice) || 0;

  // Weighted-average merge preview when restocking an existing product.
  const mergePreview = useMemo(() => {
    if (!selectedExisting || newQuantity <= 0 || newPurchasePrice <= 0) return null;
    const isOutOfStock = selectedExisting.quantity === 0;
    const totalQty = isOutOfStock ? newQuantity : selectedExisting.quantity + newQuantity;
    const totalPP = isOutOfStock
      ? newPurchasePrice
      : (selectedExisting.purchasePrice ?? 0) + newPurchasePrice;
    const avgPricePerUnit = calculatePricePerUnit(totalPP, totalQty, hstValue);
    return { totalQty, totalPP, avgPricePerUnit, isOutOfStock };
  }, [selectedExisting, newQuantity, newPurchasePrice, hstValue]);

  // Price/unit preview for a brand-new product
  const computedPricePerUnit = useMemo(() => {
    if (!newPurchasePrice || !newQuantity) return null;
    return calculatePricePerUnit(newPurchasePrice, newQuantity, hstValue);
  }, [newPurchasePrice, newQuantity, hstValue]);

  const handleSelectExisting = useCallback((item: InventoryItem) => {
    setSelectedExistingId(item.id);
    setForm({
      deviceName: item.deviceName,
      brand: item.brand,
      grade: item.grade,
      storage: item.storage,
      quantity: "",
      purchasePrice: "",
      hst: item.hst?.toString() ?? "13",
      sellingPrice: item.sellingPrice.toString(),
      imei: "",
      serialNumber: "",
    });
    setComboboxOpen(false);
  }, []);

  const handleClearSelection = () => {
    setSelectedExistingId(null);
    setForm(defaultForm);
  };

  const handleField = (field: keyof ProductForm, value: string) => {
    if (field === "deviceName" && selectedExistingId) {
      setSelectedExistingId(null);
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid = Boolean(
    form.deviceName.trim() &&
    form.brand.trim() &&
    form.grade &&
    form.storage.trim() &&
    newQuantity > 0 &&
    newPurchasePrice > 0 &&
    sellingPrice > 0 &&
    hasIdentifier,
  );

  const isBulkConfigValid = Boolean(
    form.deviceName.trim() &&
    form.brand.trim() &&
    form.grade &&
    form.storage.trim() &&
    newPurchasePrice > 0 &&
    sellingPrice > 0,
  );

  const normalizedIdentifierSet = useMemo(
    () => new Set(bulkRows.map((row) => row.identifier.toLowerCase())),
    [bulkRows],
  );

  const getIdentifierType = useCallback(
    (rawValue: string): { imei: string | null; serialNumber: string | null } => {
      const normalizedValue = rawValue.trim();
      if (!normalizedValue) return { imei: null, serialNumber: null };

      const onlyDigits = /^\d+$/.test(normalizedValue);
      const isImeiLike = onlyDigits && normalizedValue.length >= 14 && normalizedValue.length <= 17;

      if (isImeiLike) {
        return { imei: normalizedValue, serialNumber: null };
      }

      return { imei: null, serialNumber: normalizedValue };
    },
    [],
  );

  const addBulkIdentifier = useCallback(
    (rawValue: string) => {
      const normalizedValue = rawValue.trim();
      if (!normalizedValue) {
        return;
      }

      if (normalizedIdentifierSet.has(normalizedValue.toLowerCase())) {
        toast.error(`Duplicate scan ignored: ${normalizedValue}`);
        return;
      }

      const typedIdentifier = getIdentifierType(normalizedValue);
      if (!typedIdentifier.imei && !typedIdentifier.serialNumber) {
        toast.error("Invalid identifier. Scan IMEI or Serial Number.");
        return;
      }

      const nextRow: BulkScanRow = {
        id: crypto.randomUUID(),
        identifier: normalizedValue,
        imei: typedIdentifier.imei,
        serialNumber: typedIdentifier.serialNumber,
        status: "pending",
      };

      setBulkRows((prev) => [nextRow, ...prev]);
      setBulkScanInput("");
      setBulkSummary(null);
    },
    [getIdentifierType, normalizedIdentifierSet],
  );

  const handleBulkScanSubmit = useCallback(() => {
    addBulkIdentifier(bulkScanInput);
  }, [addBulkIdentifier, bulkScanInput]);

  const handleBulkScanKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleBulkScanSubmit();
    },
    [handleBulkScanSubmit],
  );

  const handleRemoveBulkRow = useCallback((rowId: string) => {
    setBulkRows((prev) => prev.filter((row) => row.id !== rowId));
    setBulkSummary(null);
  }, []);

  const handleResetBulkRows = useCallback(() => {
    setBulkRows([]);
    setBulkScanInput("");
    setBulkSummary(null);
  }, []);

  const runBulkValidation = useCallback(async (): Promise<BulkScanRow[]> => {
    if (!companyId) {
      throw new Error("No active company context");
    }

    if (!bulkRows.length) {
      throw new Error("Please scan at least one IMEI/Serial Number for bulk add.");
    }

    const nextRows: BulkScanRow[] = [];
    const seen = new Set<string>();

    for (const row of bulkRows) {
      const dedupeKey = row.identifier.toLowerCase();
      if (seen.has(dedupeKey)) {
        nextRows.push({ ...row, status: "invalid", reason: "Duplicate in current bulk list" });
        continue;
      }
      seen.add(dedupeKey);
      nextRows.push({ ...row, status: "valid", reason: undefined });
    }

    const imeis = nextRows
      .filter((row) => row.status === "valid" && row.imei)
      .map((row) => row.imei as string);
    const serialNumbers = nextRows
      .filter((row) => row.status === "valid" && row.serialNumber)
      .map((row) => row.serialNumber as string);

    const existingImeiSet = new Set<string>();
    const existingSerialSet = new Set<string>();

    if (imeis.length) {
      const { data, error } = await (supabase as any)
        .from("inventory")
        .select("imei")
        .eq("company_id", companyId)
        .in("imei", imeis);

      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Array<{ imei: string | null }>) {
        if (row.imei) existingImeiSet.add(row.imei.toLowerCase());
      }
    }

    if (serialNumbers.length) {
      const { data, error } = await (supabase as any)
        .from("inventory")
        .select("serial_number")
        .eq("company_id", companyId)
        .in("serial_number", serialNumbers);

      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Array<{ serial_number: string | null }>) {
        if (row.serial_number) existingSerialSet.add(row.serial_number.toLowerCase());
      }
    }

    return nextRows.map((row) => {
      if (row.status === "invalid") return row;

      if (row.imei && existingImeiSet.has(row.imei.toLowerCase())) {
        return { ...row, status: "invalid", reason: "IMEI already exists in inventory" };
      }

      if (row.serialNumber && existingSerialSet.has(row.serialNumber.toLowerCase())) {
        return { ...row, status: "invalid", reason: "Serial Number already exists in inventory" };
      }

      return row;
    });
  }, [bulkRows, companyId]);

  const handleBulkReview = useCallback(async () => {
    if (!isBulkConfigValid) {
      toast.error("Fill all shared product details before reviewing bulk list.");
      return;
    }

    setIsBulkReviewing(true);
    try {
      const validatedRows = await runBulkValidation();
      const valid = validatedRows.filter((row) => row.status === "valid").length;
      const invalid = validatedRows.length - valid;

      setBulkRows(validatedRows);
      setBulkSummary({
        total: validatedRows.length,
        valid,
        invalid,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk validation failed");
    } finally {
      setIsBulkReviewing(false);
    }
  }, [isBulkConfigValid, runBulkValidation]);

  const handleBulkInsert = useCallback(async () => {
    if (!bulkSummary || bulkSummary.valid === 0) {
      toast.error("No valid rows to add. Please scan and review again.");
      return;
    }

    setIsBulkSaving(true);
    try {
      const validRows = bulkRows.filter((row) => row.status === "valid");
      const hstForBulk = Number(form.hst) || 0;
      const purchasePriceForBulk = Number(form.purchasePrice);
      const pricePerUnit = calculatePricePerUnit(purchasePriceForBulk, 1, hstForBulk);

      const payload: InventoryItem[] = validRows.map((row) => ({
        id: "",
        deviceName: form.deviceName.trim(),
        brand: form.brand.trim(),
        grade: form.grade as Grade,
        storage: form.storage.trim(),
        quantity: 1,
        purchasePrice: purchasePriceForBulk,
        hst: hstForBulk || null,
        pricePerUnit,
        sellingPrice: Number(form.sellingPrice),
        lastUpdated: "Just now",
        priceChange: "stable",
        isActive: true,
        imei: row.imei,
        serialNumber: row.serialNumber,
        status: "in_stock",
      }));

      const result = await bulkInsertProducts(payload);

      if (result.insertedIds?.length && user?.id && companyId) {
        const logRows = result.insertedIds.map((inventoryId) => ({
          company_id: companyId,
          inventory_id: inventoryId,
          event_type: "inventory_item_created",
          new_status: "in_stock",
          performed_by: user.id,
        }));
        const { error: logError } = await (supabase as any)
          .from("inventory_activity_logs")
          .insert(logRows);
        if (logError) {
          console.error("Failed to insert bulk activity logs:", logError);
        }
      }

      if (result.failed > 0) {
        toast.success(`${result.success} products added. ${result.failed} failed.`);
      } else {
        toast.success(`${result.success} products added to inventory.`);
      }

      handleClose();
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk insert failed");
    } finally {
      setIsBulkSaving(false);
    }
  }, [
    bulkInsertProducts,
    bulkRows,
    bulkSummary,
    companyId,
    form.brand,
    form.deviceName,
    form.grade,
    form.hst,
    form.purchasePrice,
    form.sellingPrice,
    form.storage,
    onSuccess,
    user?.id,
  ]);

  const handleNextStep = () => {
    if (!isFormValid) return;
    setStep("review");
  };

  const handleSubmit = async (colorRows: ColourRow[]) => {
    setIsSubmitting(true);
    try {
      let savedInventoryId: string | null = null;
      const imeiValue = form.imei.trim() || null;
      const serialValue = form.serialNumber.trim() || null;

      if (selectedExisting && hasIdentifier) {
        // ── Case 1: Scan a new unit of an existing device configuration ──────
        // Increment the shared quantity counter and register the new identifier.
        await updateProduct(selectedExisting.id, {
          quantity: selectedExisting.quantity + 1,
        });
        await addInventoryIdentifier(selectedExisting.id, imeiValue, serialValue);
        savedInventoryId = selectedExisting.id;
        toast.success(
          `${form.deviceName} — 1 unit added (${imeiValue ? `IMEI: ${imeiValue}` : `S/N: ${serialValue}`})`,
        );
        onRestockComplete?.(selectedExisting.id);
      } else if (selectedExisting && mergePreview && !hasIdentifier) {
        // ── Case 2: Legacy restock without a scanned identifier ──────────────
        await updateProduct(selectedExisting.id, {
          quantity: mergePreview.totalQty,
          purchasePrice: mergePreview.totalPP,
          pricePerUnit: mergePreview.avgPricePerUnit,
          sellingPrice,
          hst: hstValue || null,
        });
        savedInventoryId = selectedExisting.id;
        toast.success(
          `${form.deviceName} restocked — ${newQuantity} unit${newQuantity !== 1 ? "s" : ""} added`,
        );
        onRestockComplete?.(selectedExisting.id);
      } else {
        // ── Case 3: New product configuration ───────────────────────────────
        const pricePerUnit = calculatePricePerUnit(newPurchasePrice, newQuantity, hstValue);
        const result = await bulkInsertProducts([
          {
            id: "",
            deviceName: form.deviceName.trim(),
            brand: form.brand.trim(),
            grade: form.grade as Grade,
            storage: form.storage.trim(),
            quantity: newQuantity,
            purchasePrice: newPurchasePrice,
            hst: hstValue || null,
            pricePerUnit,
            sellingPrice,
            lastUpdated: "Just now",
            priceChange: "stable",
            isActive: true,
          },
        ]);

        savedInventoryId = result.insertedIds?.[0] ?? null;

        // Register the scanned identifier against the new inventory record.
        if (hasIdentifier && savedInventoryId) {
          await addInventoryIdentifier(savedInventoryId, imeiValue, serialValue);
        }

        toast.success(`${form.deviceName} added to inventory`);
      }

      // ── Activity Log ───────────────────────────────────────────────
      if (savedInventoryId && user?.id && companyId) {
        const { error: logError } = await (supabase as any).from("inventory_activity_logs").insert({
          company_id: companyId,
          inventory_id: savedInventoryId,
          event_type: "inventory_item_created",
          new_status: "in_stock",
          performed_by: user.id,
        });
        if (logError) console.error("Failed to insert activity log:", logError);
      }

      // ── Save colour breakdown ───────────────────────────────────────────────
      const inventoryId = savedInventoryId; // narrow to string for callbacks
      if (inventoryId && colorRows.length > 0) {
        const rows = colorRows
          .filter((r) => r.color.trim() && Number(r.quantity) > 0)
          .map((r) => ({
            inventory_id: inventoryId,
            color: r.color.trim(),
            quantity: Number(r.quantity),
            updated_at: new Date().toISOString(),
          }));

        if (rows.length > 0) {
          const { error: upsertError } = await (supabase as any)
            .from("inventory_colors")
            .upsert(rows, { onConflict: "inventory_id,color" });
          if (upsertError) throw new Error(`Colour save failed: ${upsertError.message}`);

          // Remove colours no longer in the breakdown
          const keptColors = rows.map((r) => r.color);
          const { data: existing } = await (supabase as any)
            .from("inventory_colors")
            .select("color")
            .eq("inventory_id", inventoryId);
          const toDelete = (existing ?? [])
            .map((r: { color: string }) => r.color)
            .filter((c: string) => !keptColors.includes(c));
          if (toDelete.length > 0) {
            const { error: deleteError } = await (supabase as any)
              .from("inventory_colors")
              .delete()
              .eq("inventory_id", inventoryId)
              .in("color", toDelete);
            if (deleteError) throw new Error(`Colour cleanup failed: ${deleteError.message}`);
          }
        }
      }

      handleClose();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setForm(defaultForm);
      setSelectedExistingId(null);
      setMode("single");
      setStep("form");
      setBulkRows([]);
      setBulkScanInput("");
      setIsBulkReviewing(false);
      setIsBulkSaving(false);
      setBulkSummary(null);
      setComboboxOpen(false);
      setColourDialogOpen(false);
      setExistingColorRows([]);
      setIsLoadingExistingColors(false);
      setSuggestedColors([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[calc(100%-1rem)] mx-auto max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Package className="h-4 w-4 text-primary" />
            </div>
            Add Product to Inventory
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Search for an existing product to restock, or fill in the form to add a new one.
            Purchase prices are automatically averaged.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1">
          <div className="space-y-4 pt-1 mb-4">
            <div className="bg-muted/50 px-3 py-2 rounded-lg text-sm font-medium text-foreground">
              Single product
            </div>
          </div>

          {mode === "single" && step === "form" && (
            <div className="space-y-5">
              {/* ── Product search combobox ───────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Search Existing Products</Label>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between font-normal h-10"
                    >
                      <span
                        className={cn(
                          "truncate text-sm",
                          !form.deviceName && "text-muted-foreground",
                        )}
                      >
                        {form.deviceName || "Search by name, grade, storage…"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                    side="bottom"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <Command>
                      <CommandInput placeholder="Type to filter…" className="h-9" />
                      <CommandList className="max-h-60">
                        <CommandEmpty>
                          <div className="py-5 text-center space-y-1">
                            <p className="text-sm font-medium text-foreground">No match found</p>
                            <p className="text-xs text-muted-foreground">
                              Fill in the form below to add a new product.
                            </p>
                          </div>
                        </CommandEmpty>
                        <CommandGroup
                          heading={`${inventory.length} product${inventory.length !== 1 ? "s" : ""} in inventory`}
                        >
                          {inventory.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={`${item.deviceName} ${item.grade} ${item.storage} ${item.brand}`}
                              onSelect={() => handleSelectExisting(item)}
                              className="py-2 cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 shrink-0 text-primary",
                                  selectedExistingId === item.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="flex flex-1 items-center justify-between min-w-0 gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate leading-tight">
                                    {item.deviceName}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {item.storage} · Qty:{" "}
                                    <strong className="text-foreground">{item.quantity}</strong> ·{" "}
                                    {formatPrice(item.sellingPrice)}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    "shrink-0 inline-flex items-center justify-center text-xs font-bold w-6 h-6 rounded border",
                                    GRADE_STYLES[item.grade],
                                  )}
                                >
                                  {item.grade}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Selected product banner */}
                {selectedExisting && (
                  <div className="flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground flex-1 min-w-0">
                      Restocking{" "}
                      <strong className="text-foreground">{selectedExisting.deviceName}</strong> —
                      Grade {selectedExisting.grade}, {selectedExisting.storage}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <Separator />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-background px-2 text-xs text-muted-foreground">
                    Product Details
                  </span>
                </span>
              </div>

              {/* ── Form fields ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                {/* IMEI */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ap-imei"
                    className="text-sm font-medium text-amber-700 dark:text-amber-500"
                  >
                    IMEI (Scanner focus)
                  </Label>
                  <Input
                    id="ap-imei"
                    placeholder="Scan or type IMEI"
                    value={form.imei}
                    onChange={(e) => handleField("imei", e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Serial Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-serial" className="text-sm font-medium">
                    Serial Number
                  </Label>
                  <Input
                    id="ap-serial"
                    placeholder="Scan or type Serial"
                    value={form.serialNumber}
                    onChange={(e) => handleField("serialNumber", e.target.value)}
                  />
                </div>

                {/* Device Name */}
                <div className="col-span-2 space-y-1.5 mt-2">
                  <Label htmlFor="ap-device" className="text-sm font-medium">
                    Device Name
                  </Label>
                  <Input
                    id="ap-device"
                    placeholder="e.g. iPhone 12"
                    value={form.deviceName}
                    onChange={(e) => handleField("deviceName", e.target.value)}
                    disabled={!!selectedExisting}
                    className={
                      selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""
                    }
                  />
                </div>

                {/* Brand */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-brand" className="text-sm font-medium">
                    Brand
                  </Label>
                  <Input
                    id="ap-brand"
                    placeholder="e.g. Apple"
                    value={form.brand}
                    onChange={(e) => handleField("brand", e.target.value)}
                    disabled={!!selectedExisting}
                    className={
                      selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""
                    }
                  />
                </div>

                {/* Grade */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Grade</Label>
                  <Select
                    value={form.grade}
                    onValueChange={(v) => handleField("grade", v)}
                    disabled={!!selectedExisting}
                  >
                    <SelectTrigger
                      className={
                        selectedExisting
                          ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                          : ""
                      }
                    >
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => (
                        <SelectItem key={g} value={g}>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center rounded text-xs font-bold border px-1.5 py-0.5 min-w-[1.5rem]",
                                GRADE_STYLES[g],
                              )}
                            >
                              {GRADE_BADGE_LABELS[g]}
                            </span>
                            {GRADE_LABELS[g]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Storage */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-storage" className="text-sm font-medium">
                    Storage
                  </Label>
                  <Input
                    id="ap-storage"
                    placeholder="e.g. 128GB"
                    value={form.storage}
                    onChange={(e) => handleField("storage", e.target.value)}
                    disabled={!!selectedExisting}
                    className={
                      selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""
                    }
                  />
                </div>

                {/* HST */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-hst" className="text-sm font-medium">
                    HST %
                  </Label>
                  <Input
                    id="ap-hst"
                    type="number"
                    placeholder="13"
                    value={form.hst}
                    onChange={(e) => handleField("hst", e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-qty" className="text-sm font-medium">
                    {selectedExisting ? "Units to Add" : "Quantity"}
                  </Label>
                  <Input
                    id="ap-qty"
                    type="number"
                    placeholder="0"
                    value={hasIdentifier ? "1" : form.quantity}
                    onChange={(e) => handleField("quantity", e.target.value)}
                    min="1"
                    disabled={hasIdentifier}
                    className={hasIdentifier ? "bg-muted/50 cursor-not-allowed" : ""}
                  />
                </div>

                {/* Purchase Price */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-pp" className="text-sm font-medium">
                    {selectedExisting ? "Purchase Price (this batch)" : "Total Purchase Price"}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ap-pp"
                      type="number"
                      placeholder="0.00"
                      value={form.purchasePrice}
                      onChange={(e) => handleField("purchasePrice", e.target.value)}
                      min="0"
                      step="0.01"
                      className="pl-6"
                    />
                  </div>
                </div>

                {/* Selling Price */}
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ap-sp" className="text-sm font-medium">
                    Selling Price (per unit)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ap-sp"
                      type="number"
                      placeholder="0.00"
                      value={form.sellingPrice}
                      onChange={(e) => handleField("sellingPrice", e.target.value)}
                      min="0"
                      step="0.01"
                      className="pl-6"
                    />
                  </div>
                </div>
              </div>

              {/* ── Merge preview for restocking ──────────────────────────────── */}
              {selectedExisting && mergePreview && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {mergePreview.isOutOfStock ? "Fresh Batch" : "Merge Preview"}
                    </p>
                    {mergePreview.isOutOfStock && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Item was out of stock — existing cost not carried forward
                      </span>
                    )}
                  </div>

                  {mergePreview.isOutOfStock ? (
                    <div className="p-4 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">New Qty</p>
                        <p className="text-sm font-bold tabular-nums">{mergePreview.totalQty}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Batch Cost</p>
                        <p className="text-sm font-bold tabular-nums">
                          {formatPrice(mergePreview.totalPP)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Current Qty</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {selectedExisting.quantity}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Adding</p>
                        <p className="text-sm font-semibold text-primary tabular-nums">
                          +{newQuantity}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">New Total</p>
                        <p className="text-sm font-bold tabular-nums">{mergePreview.totalQty}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Existing Cost</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatPrice(selectedExisting.purchasePrice ?? 0)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Batch Cost</p>
                        <p className="text-sm font-semibold text-primary tabular-nums">
                          +{formatPrice(newPurchasePrice)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Total Cost</p>
                        <p className="text-sm font-bold tabular-nums">
                          {formatPrice(mergePreview.totalPP)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      {mergePreview.isOutOfStock
                        ? "Price / Unit (incl. HST)"
                        : "Avg. Price / Unit (incl. HST)"}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {formatPrice(mergePreview.avgPricePerUnit)}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Price/unit preview for new product ───────────────────────── */}
              {!selectedExisting &&
                computedPricePerUnit !== null &&
                newQuantity > 0 &&
                newPurchasePrice > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      Calculated Price / Unit (incl. HST)
                    </span>
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {formatPrice(computedPricePerUnit)}
                    </span>
                  </div>
                )}

              {/* ── Actions ──────────────────────────────────────────────────── */}
              <div className="flex gap-3 pt-1 pb-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleNextStep} disabled={!isFormValid}>
                  Review Details
                </Button>
              </div>
            </div>
          )}

          {mode === "single" && step === "review" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <h4 className="font-semibold text-sm">Product Overview</h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Device</dt>
                    <dd className="font-medium">{form.deviceName || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Brand</dt>
                    <dd className="font-medium">{form.brand || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Grade</dt>
                    <dd className="font-medium">{form.grade || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Storage</dt>
                    <dd className="font-medium">{form.storage || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground text-amber-600 dark:text-amber-500">
                      IMEI
                    </dt>
                    <dd className="font-medium">{form.imei || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Serial</dt>
                    <dd className="font-medium">{form.serialNumber || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Quantity</dt>
                    <dd className="font-medium">{hasIdentifier ? 1 : form.quantity}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Purchase Price</dt>
                    <dd className="font-medium">{formatPrice(Number(form.purchasePrice) || 0)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Selling Price</dt>
                    <dd className="font-medium">{formatPrice(Number(form.sellingPrice) || 0)}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("form")}
                  disabled={isSubmitting}
                >
                  Back to Edit
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setColourDialogOpen(true)}
                  disabled={isSubmitting}
                >
                  <Palette className="h-4 w-4 mr-2" />
                  Confirm & Configure Colors
                </Button>
              </div>
            </div>
          )}

          {mode === "bulk" && (
            <div className="space-y-4 pb-1">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <h4 className="text-sm font-semibold">Shared Product Configuration</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="bulk-device" className="text-sm font-medium">
                      Device Name
                    </Label>
                    <Input
                      id="bulk-device"
                      placeholder="e.g. iPhone 8"
                      value={form.deviceName}
                      onChange={(event) => handleField("deviceName", event.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bulk-brand" className="text-sm font-medium">
                      Brand
                    </Label>
                    <Input
                      id="bulk-brand"
                      placeholder="e.g. Apple"
                      value={form.brand}
                      onChange={(event) => handleField("brand", event.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Grade</Label>
                    <Select
                      value={form.grade}
                      onValueChange={(value) => handleField("grade", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade" />
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
                    <Label htmlFor="bulk-storage" className="text-sm font-medium">
                      Storage
                    </Label>
                    <Input
                      id="bulk-storage"
                      placeholder="e.g. 64GB"
                      value={form.storage}
                      onChange={(event) => handleField("storage", event.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bulk-hst" className="text-sm font-medium">
                      HST %
                    </Label>
                    <Input
                      id="bulk-hst"
                      type="number"
                      placeholder="13"
                      value={form.hst}
                      onChange={(event) => handleField("hst", event.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bulk-purchase" className="text-sm font-medium">
                      Purchase Price (per unit)
                    </Label>
                    <Input
                      id="bulk-purchase"
                      type="number"
                      placeholder="0.00"
                      value={form.purchasePrice}
                      onChange={(event) => handleField("purchasePrice", event.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bulk-selling" className="text-sm font-medium">
                      Selling Price (per unit)
                    </Label>
                    <Input
                      id="bulk-selling"
                      type="number"
                      placeholder="0.00"
                      value={form.sellingPrice}
                      onChange={(event) => handleField("sellingPrice", event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">Scan IMEI / Serial Numbers</h4>
                  <Badge variant="secondary">{bulkRows.length} scanned</Badge>
                </div>

                <div className="flex gap-2">
                  <Input
                    id="bulk-scan"
                    value={bulkScanInput}
                    placeholder="Scan and press Enter"
                    onChange={(event) => setBulkScanInput(event.target.value)}
                    onKeyDown={handleBulkScanKeyDown}
                    aria-label="Scan IMEI or serial number"
                  />
                  <Button type="button" variant="outline" onClick={handleBulkScanSubmit}>
                    Add
                  </Button>
                </div>

                {bulkRows.length > 0 ? (
                  <div className="rounded-md border max-h-52 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium">Identifier</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{row.identifier}</td>
                            <td className="px-3 py-2">{row.imei ? "IMEI" : "Serial"}</td>
                            <td className="px-3 py-2">
                              {row.status === "pending" && "Pending review"}
                              {row.status === "valid" && (
                                <span className="text-emerald-600">Valid</span>
                              )}
                              {row.status === "invalid" && (
                                <span className="text-destructive">
                                  {row.reason ?? "Invalid row"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveBulkRow(row.id)}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Start scanning devices. Each scan adds one identifier row.
                  </p>
                )}

                {bulkSummary && (
                  <div className="rounded-md border bg-muted/20 p-3 text-sm">
                    <p className="font-medium">Bulk Review Summary</p>
                    <p className="text-muted-foreground mt-1">
                      Total: {bulkSummary.total} | Valid: {bulkSummary.valid} | Invalid:{" "}
                      {bulkSummary.invalid}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleResetBulkRows}
                    disabled={isBulkReviewing || isBulkSaving || bulkRows.length === 0}
                  >
                    Clear List
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleBulkReview}
                    disabled={isBulkReviewing || isBulkSaving || bulkRows.length === 0}
                  >
                    {isBulkReviewing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Reviewing
                      </>
                    ) : (
                      "Review Bulk List"
                    )}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleClose}
                    disabled={isBulkSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleBulkInsert}
                    disabled={isBulkSaving || !bulkSummary || bulkSummary.valid === 0}
                  >
                    {isBulkSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding
                      </>
                    ) : (
                      "Confirm & Add Bulk Products"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Colour breakdown opens as a separate dialog on top */}
      <ColourBreakdownDialog
        open={colourDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) setColourDialogOpen(false);
        }}
        productName={form.deviceName || "this product"}
        totalQuantity={
          selectedExisting && hasIdentifier
            ? selectedExisting.quantity + 1
            : isLegacyRestock && mergePreview
              ? mergePreview.totalQty
              : newQuantity
        }
        initialColors={selectedExistingId ? existingColorRows : undefined}
        suggestedColors={suggestedColors}
        note={
          selectedExisting && hasIdentifier
            ? `Covers all ${selectedExisting.quantity + 1} units — ${selectedExisting.quantity} existing + 1 new. Increment the colour that matches this unit.`
            : isLegacyRestock && mergePreview
              ? `Covers all ${mergePreview.totalQty} units — ${selectedExisting.quantity} existing + ${newQuantity} new batch. Previously assigned colours are pre-filled.`
              : undefined
        }
        isLoadingInitialColors={isLoadingExistingColors}
        onConfirm={handleSubmit}
        isSaving={isSubmitting}
        confirmLabel={selectedExisting ? "Update Inventory" : "Add to Inventory"}
      />
    </Dialog>
  );
}
