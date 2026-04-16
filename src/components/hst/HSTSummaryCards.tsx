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
  /** Weighted avg purchase HST % (for benchmark comparison). */
  avgPurchaseRate: number;
  /**
   * Sum over orders taxed below avg purchase rate: (subtotal × avg%) − HST collected.
   * Matches “Saving” in Rate Difference Analysis.
   */
  totalRateBenchmarkSaving: number;
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
  avgPurchaseRate,
  totalRateBenchmarkSaving,
}: HSTSummaryCardsProps) {
  const showBenchmark =
    totalRateBenchmarkSaving > 1e-6 && Number.isFinite(avgPurchaseRate) && avgPurchaseRate > 0;

  return (
    <div
      className={cn(
        "grid gap-4",
        showBenchmark ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-3",
      )}
    >
      {/* 1 — Net remittance (primary “difference” users owe or are owed) */}
      <div className="bg-card rounded-lg border border-primary/25 shadow-soft p-4 sm:p-5 ring-1 ring-primary/10">
        <p className="text-sm font-medium text-muted-foreground">Net HST to CRA</p>
        <p
          className={cn(
            "text-3xl font-bold mt-1 tabular-nums tracking-tight",
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
          <span className="text-foreground font-medium">Collected − ITCs:</span>{" "}
          <span className="tabular-nums">{formatPrice(totalHSTCollected)}</span> −{" "}
          <span className="tabular-nums">{formatPrice(totalHSTPaid)}</span> ={" "}
          <span className="font-semibold text-foreground tabular-nums">
            {netHSTPosition >= 0 ? "+" : ""}
            {formatPrice(netHSTPosition)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {netHSTPosition > 0
            ? `Remit ${formatPrice(netHSTPosition)}`
            : netHSTPosition < 0
              ? `Refund / credit position ${formatPrice(Math.abs(netHSTPosition))}`
              : "Balanced"}
        </p>
      </div>

      {/* 2 — Benchmark vs avg purchase rate (same math as Rate Difference Analysis) */}
      {showBenchmark && (
        <div className="bg-card rounded-lg border border-border shadow-soft p-4 sm:p-5">
          <p className="text-sm font-medium text-muted-foreground">
            Vs avg purchase rate ({formatPct(avgPurchaseRate)})
          </p>
          <p className="text-3xl font-bold text-success mt-1 tabular-nums tracking-tight">
            −{formatPrice(totalRateBenchmarkSaving)}
          </p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            On orders taxed below {formatPct(avgPurchaseRate)}, you collected this much{" "}
            <span className="text-foreground font-medium">less</span> than if those subtotals were
            taxed at your average purchase HST rate (benchmark only — not additional remittance).
          </p>
        </div>
      )}

      {/* ITCs */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">HST Input Tax Credits</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <p className="text-xl font-bold text-foreground tabular-nums">
            {formatPrice(totalHSTPaid)}
          </p>
          {itcEffectivePercent != null && (
            <span className="text-sm font-semibold text-primary tabular-nums">
              {formatPct(itcEffectivePercent)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {purchaseCount} purchase line{purchaseCount !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Tax-exclusive base {formatPrice(totalPurchaseBase)}
        </p>
      </div>

      {/* Collected — supporting detail; actual remittance is Net above */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">HST collected (output tax)</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <p className="text-xl font-bold text-foreground tabular-nums">
            {formatPrice(totalHSTCollected)}
          </p>
          {collectedEffectivePercent != null && (
            <span className="text-sm font-semibold text-primary tabular-nums">
              {formatPct(collectedEffectivePercent)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {salesCount} taxable order{salesCount !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">Subtotals {formatPrice(totalSalesSubtotal)}</p>
      </div>
    </div>
  );
}
