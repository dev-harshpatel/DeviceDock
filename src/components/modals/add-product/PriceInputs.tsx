"use client";

import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MergePreviewCard } from "@/components/modals/MergePreviewCard";
import { formatPrice } from "@/lib/utils";
import type { ProductForm } from "@/hooks/use-add-product";
import type { InventoryItem } from "@/data/inventory";

interface PriceInputsProps {
  form: ProductForm;
  handleField: (field: keyof ProductForm, value: string) => void;
  selectedExisting: InventoryItem | null;
  selectedExistingEffective: InventoryItem | null;
  newQuantity: number;
  newPurchasePrice: number;
  hstValue: number;
  computedPricePerUnit: number | null;
  mergePreview: {
    totalQty: number;
    totalPP: number;
    avgPricePerUnit: number;
    isOutOfStock: boolean;
  } | null;
}

export function PriceInputs({
  form,
  handleField,
  selectedExisting,
  selectedExistingEffective,
  newQuantity,
  newPurchasePrice,
  computedPricePerUnit,
  mergePreview,
}: PriceInputsProps) {
  return (
    <>
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

      {/* ── Merge preview for restocking ──────────────────────────────── */}
      {selectedExisting && mergePreview && (
        <div className="col-span-2">
          <MergePreviewCard
            mergePreview={mergePreview}
            newQuantity={newQuantity}
            newPurchasePrice={newPurchasePrice}
            selectedExisting={selectedExisting}
            selectedExistingEffective={selectedExistingEffective}
          />
        </div>
      )}

      {/* ── Price/unit preview for new product ───────────────────────── */}
      {!selectedExisting &&
        computedPricePerUnit !== null &&
        newQuantity > 0 &&
        newPurchasePrice > 0 && (
          <div className="col-span-2 flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Calculated Price / Unit (incl. HST)
            </span>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {formatPrice(computedPricePerUnit)}
            </span>
          </div>
        )}
    </>
  );
}
