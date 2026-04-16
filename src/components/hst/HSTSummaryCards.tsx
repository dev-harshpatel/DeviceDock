import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface HSTSummaryCardsProps {
  totalHSTPaid: number;
  totalHSTCollected: number;
  netHSTPosition: number;
  purchaseCount: number;
  salesCount: number;
  totalPurchaseBase: number;
  totalSalesSubtotal: number;
  /** Effective ITC % = total ITCs ÷ tax-exclusive purchase base (null if no base). */
  itcEffectivePercent: number | null;
  /** Effective collected % = total HST collected ÷ taxable subtotals (null if no subtotal). */
  collectedEffectivePercent: number | null;
}

const formatPct = (v: number | null) => (v == null || Number.isNaN(v) ? "—" : `${v.toFixed(2)}%`);

export function HSTSummaryCards({
  totalHSTPaid,
  totalHSTCollected,
  netHSTPosition,
  purchaseCount,
  salesCount,
  totalPurchaseBase,
  totalSalesSubtotal,
  itcEffectivePercent,
  collectedEffectivePercent,
}: HSTSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* HST Paid (ITCs) */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">HST Input Tax Credits</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <p className="text-2xl font-bold text-foreground">{formatPrice(totalHSTPaid)}</p>
          {itcEffectivePercent != null && (
            <span className="text-sm font-semibold text-primary tabular-nums">
              {formatPct(itcEffectivePercent)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Paid on {purchaseCount} inventory purchase{purchaseCount !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Tax-exclusive base: {formatPrice(totalPurchaseBase)} · Claimable from CRA
        </p>
      </div>

      {/* HST Collected */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">HST Collected from Sales</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <p className="text-2xl font-bold text-foreground">{formatPrice(totalHSTCollected)}</p>
          {collectedEffectivePercent != null && (
            <span className="text-sm font-semibold text-primary tabular-nums">
              {formatPct(collectedEffectivePercent)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Across {salesCount} taxable order{salesCount !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Taxable subtotals: {formatPrice(totalSalesSubtotal)} · Must be remitted to CRA
        </p>
      </div>

      {/* Net Position */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">Net HST Position</p>
        <p
          className={cn(
            "text-2xl font-bold mt-1",
            netHSTPosition > 0
              ? "text-amber-600 dark:text-amber-400"
              : netHSTPosition < 0
                ? "text-success"
                : "text-foreground",
          )}
        >
          {netHSTPosition >= 0 ? "+" : ""}
          {formatPrice(netHSTPosition)}
        </p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          <span className="text-foreground font-medium">Difference:</span>{" "}
          <span className="tabular-nums">{formatPrice(totalHSTCollected)}</span> collected −{" "}
          <span className="tabular-nums">{formatPrice(totalHSTPaid)}</span> ITCs ={" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              netHSTPosition > 0
                ? "text-amber-700 dark:text-amber-300"
                : netHSTPosition < 0
                  ? "text-success"
                  : "text-foreground",
            )}
          >
            {netHSTPosition >= 0 ? "+" : ""}
            {formatPrice(netHSTPosition)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {netHSTPosition > 0
            ? `Owing to CRA — remit ${formatPrice(netHSTPosition)}`
            : netHSTPosition < 0
              ? `Refund position — ${formatPrice(Math.abs(netHSTPosition))} more ITCs than collected`
              : "Balanced — no amount owing"}
        </p>
      </div>
    </div>
  );
}
