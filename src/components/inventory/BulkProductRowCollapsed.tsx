"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BulkProductRowForm } from "@/types/bulk-products";
import { formatPrice } from "@/lib/utils";

interface BulkProductRowCollapsedProps {
  index: number;
  row: BulkProductRowForm;
  isSubmitting: boolean;
  onExpand: () => void;
  onRemove: () => void;
}

export function BulkProductRowCollapsed({
  index,
  row,
  isSubmitting,
  onExpand,
  onRemove,
}: BulkProductRowCollapsedProps) {
  const qty = Number(row.quantity) || 0;
  const pp = Number(row.purchasePrice) || 0;
  const sp = Number(row.sellingPrice) || 0;
  const hst = Number(row.hst) || 0;
  const specParts = [row.brand.trim(), row.grade, row.storage.trim()].filter(Boolean).join(" · ");

  return (
    <article className="rounded-lg border border-border bg-muted/20 shadow-sm">
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
            <span className="text-muted-foreground text-xs sm:text-sm">{specParts}</span>
          ) : null}
          <span className="text-xs text-muted-foreground tabular-nums">
            Qty {qty > 0 ? qty : "-"} · Purchase {pp > 0 ? formatPrice(pp) : "-"} · Sell{" "}
            {sp > 0 ? formatPrice(sp) : "-"}
            {hst ? ` · HST ${hst}%` : ""}
          </span>
        </div>
        <div className="flex items-center justify-end gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={onExpand}
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
            onClick={onRemove}
            disabled={isSubmitting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
