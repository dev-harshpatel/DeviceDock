"use client";

import { cn, formatPrice } from "@/lib/utils";
import { ProfitRowCard, type ProfitRow } from "@/components/modals/ProfitRowCard";

interface OrderProfitSectionProps {
  profitRows: ProfitRow[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalMargin: number;
}

export function OrderProfitSection({
  profitRows,
  totalRevenue,
  totalCost,
  totalProfit,
  totalMargin,
}: OrderProfitSectionProps) {
  return (
    <div className="space-y-4 pb-3">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="font-semibold text-foreground">Profit Summary</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Estimated from item-level selling price and cost per unit (purchase price without HST when
          available).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-base sm:text-lg font-semibold text-foreground mt-1">
              {formatPrice(totalRevenue)}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="text-base sm:text-lg font-semibold text-foreground mt-1">
              {formatPrice(totalCost)}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Profit</p>
            <p
              className={cn(
                "text-base sm:text-lg font-semibold mt-1",
                totalProfit >= 0 ? "text-emerald-600" : "text-destructive",
              )}
            >
              {formatPrice(totalProfit)}
            </p>
            <p className="text-xs text-muted-foreground">Margin: {totalMargin.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Item Profit</h3>
        {profitRows.length > 0 ? (
          profitRows.map((row, i) => <ProfitRowCard key={`${row.itemName}-${i}`} row={row} />)
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground text-center">
            No items available for profit calculation.
          </div>
        )}
      </div>
    </div>
  );
}
