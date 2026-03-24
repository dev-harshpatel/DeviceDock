"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Check,
  ChevronsUpDown,
  Plus,
  Loader2,
  Package,
  Info,
  Palette,
} from "lucide-react";
import {
  ColourBreakdownDialog,
  type ColourRow,
} from "@/components/modals/ColourBreakdownDialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useInventory } from "@/contexts/InventoryContext";
import {
  type Grade,
  GRADES,
  GRADE_BADGE_LABELS,
  GRADE_LABELS,
} from "@/lib/constants/grades";

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
  const { inventory, updateProduct, bulkInsertProducts } = useInventory();
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colourDialogOpen, setColourDialogOpen] = useState(false);

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
      selectedExistingId
        ? (inventory.find((i) => i.id === selectedExistingId) ?? null)
        : null,
    [inventory, selectedExistingId]
  );

  const newQuantity = Number(form.quantity) || 0;
  const newPurchasePrice = Number(form.purchasePrice) || 0;
  const hstValue = Number(form.hst) || 0;
  const sellingPrice = Number(form.sellingPrice) || 0;

  // Weighted-average merge preview when restocking an existing product.
  const mergePreview = useMemo(() => {
    if (!selectedExisting || newQuantity <= 0 || newPurchasePrice <= 0)
      return null;
    const isOutOfStock = selectedExisting.quantity === 0;
    const totalQty = isOutOfStock
      ? newQuantity
      : selectedExisting.quantity + newQuantity;
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
      sellingPrice > 0
  );

  const handleNextStep = () => {
    if (!isFormValid) return;
    setColourDialogOpen(true);
  };

  const handleSubmit = async (colorRows: ColourRow[]) => {
    setIsSubmitting(true);
    try {
      let savedInventoryId: string | null = null;

      if (selectedExisting && mergePreview) {
        // ── Restock existing product ──────────────────────────────────────────
        await updateProduct(selectedExisting.id, {
          quantity: mergePreview.totalQty,
          purchasePrice: mergePreview.totalPP,
          pricePerUnit: mergePreview.avgPricePerUnit,
          sellingPrice,
          hst: hstValue || null,
        });
        savedInventoryId = selectedExisting.id;
        toast.success(
          `${form.deviceName} restocked — ${newQuantity} unit${newQuantity !== 1 ? "s" : ""} added`
        );
        onRestockComplete?.(selectedExisting.id);
      } else {
        // ── Insert brand-new product ──────────────────────────────────────────
        const pricePerUnit = calculatePricePerUnit(
          newPurchasePrice,
          newQuantity,
          hstValue
        );
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
        toast.success(`${form.deviceName} added to inventory`);
      }

      // ── Save colour breakdown ───────────────────────────────────────────────
      if (savedInventoryId) {
        await fetch("/api/admin/inventory-colors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventory_id: savedInventoryId,
            colors: colorRows.map((r) => ({
              color: r.color.trim(),
              quantity: Number(r.quantity),
            })),
          }),
        });
      }

      handleClose();
      onSuccess();
    } catch {
      toast.error("Failed to save product. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setForm(defaultForm);
      setSelectedExistingId(null);
      setComboboxOpen(false);
      setColourDialogOpen(false);
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
            Search for an existing product to restock, or fill in the form to add a new one. Purchase prices are automatically averaged.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1">
          <div className="space-y-5 pt-1">
              {/* ── Product search combobox ───────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Search Existing Products
                </Label>
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
                          !form.deviceName && "text-muted-foreground"
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
                      <CommandInput
                        placeholder="Type to filter…"
                        className="h-9"
                      />
                      <CommandList className="max-h-60">
                        <CommandEmpty>
                          <div className="py-5 text-center space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              No match found
                            </p>
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
                                  selectedExistingId === item.id
                                    ? "opacity-100"
                                    : "opacity-0"
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
                                    "shrink-0 inline-flex items-center justify-center text-xs font-bold w-6 h-6 rounded border",
                                    GRADE_STYLES[item.grade]
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
                      <strong className="text-foreground">
                        {selectedExisting.deviceName}
                      </strong>{" "}
                      — Grade {selectedExisting.grade},{" "}
                      {selectedExisting.storage}
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
                {/* Device Name */}
                <div className="col-span-2 space-y-1.5">
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
                      selectedExisting
                        ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                        : ""
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
                      selectedExisting
                        ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                        : ""
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
                                GRADE_STYLES[g]
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
                      selectedExisting
                        ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                        : ""
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
                    value={form.quantity}
                    onChange={(e) => handleField("quantity", e.target.value)}
                    min="1"
                  />
                </div>

                {/* Purchase Price */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-pp" className="text-sm font-medium">
                    {selectedExisting
                      ? "Purchase Price (this batch)"
                      : "Total Purchase Price"}
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
                        <p className="text-sm font-bold tabular-nums">
                          {mergePreview.totalQty}
                        </p>
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
                        <p className="text-sm font-bold tabular-nums">
                          {mergePreview.totalQty}
                        </p>
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
                <Button
                  className="flex-1"
                  onClick={handleNextStep}
                  disabled={!isFormValid}
                >
                  <Palette className="h-4 w-4 mr-2" />
                  Next: Colour Breakdown
                </Button>
              </div>
            </div>
        </div>
      </DialogContent>

      {/* Colour breakdown opens as a separate dialog on top */}
      <ColourBreakdownDialog
        open={colourDialogOpen}
        onOpenChange={(open) => { if (!open && !isSubmitting) setColourDialogOpen(false); }}
        productName={form.deviceName || "this product"}
        totalQuantity={newQuantity}
        onConfirm={handleSubmit}
        isSaving={isSubmitting}
        confirmLabel={selectedExisting ? "Update Inventory" : "Add to Inventory"}
      />
    </Dialog>
  );
}
