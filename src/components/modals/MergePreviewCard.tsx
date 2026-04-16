import { Info } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/data/inventory";

export interface MergePreview {
  isOutOfStock: boolean;
  totalQty: number;
  totalPP: number;
  avgPricePerUnit: number;
}

interface MergePreviewCardProps {
  mergePreview: MergePreview;
  newQuantity: number;
  newPurchasePrice: number;
  selectedExisting: InventoryItem;
  selectedExistingEffective: InventoryItem | null;
}

export function MergePreviewCard({
  mergePreview,
  newQuantity,
  newPurchasePrice,
  selectedExisting,
  selectedExistingEffective,
}: MergePreviewCardProps) {
  return (
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
            <p className="text-sm font-bold tabular-nums">{formatPrice(mergePreview.totalPP)}</p>
          </div>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Current Qty</p>
            <p className="text-sm font-semibold tabular-nums">
              {selectedExistingEffective?.quantity ?? selectedExisting.quantity}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Adding</p>
            <p className="text-sm font-semibold text-primary tabular-nums">+{newQuantity}</p>
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
            <p className="text-sm font-bold tabular-nums">{formatPrice(mergePreview.totalPP)}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          {mergePreview.isOutOfStock ? "Price / Unit (incl. HST)" : "Avg. Price / Unit (incl. HST)"}
        </span>
        <span className="text-sm font-bold tabular-nums text-foreground">
          {formatPrice(mergePreview.avgPricePerUnit)}
        </span>
      </div>
    </div>
  );
}
