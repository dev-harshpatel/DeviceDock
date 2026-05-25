"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { calculatePricePerUnit } from "@/data/inventory";
import type { InventoryItem } from "@/data/inventory";
import type { BulkProductRowForm } from "@/types/bulk-products";
import { cn, formatPrice } from "@/lib/utils";

const averageUnitPriceExclHst = (totalPurchase: number, quantity: number): number => {
  if (quantity <= 0) return 0;
  return Math.round((totalPurchase / quantity) * 100) / 100;
};

interface BulkRowPricePreviewProps {
  existingItem: InventoryItem | null;
  row: BulkProductRowForm;
}

export function BulkRowPricePreview({ existingItem, row }: BulkRowPricePreviewProps) {
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
}
