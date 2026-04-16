import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface HSTSummaryCardsProps {
  totalHSTPaid: number;
  totalHSTCollected: number;
  netHSTPosition: number;
  purchaseCount: number;
  salesCount: number;
  totalPurchaseBase: number;
}

export function HSTSummaryCards({
  totalHSTPaid,
  totalHSTCollected,
  netHSTPosition,
  purchaseCount,
  salesCount,
  totalPurchaseBase,
}: HSTSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* HST Paid (ITCs) */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">HST Input Tax Credits</p>
        <p className="text-2xl font-bold text-foreground mt-1">{formatPrice(totalHSTPaid)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Paid on {purchaseCount} inventory purchase{purchaseCount !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Base cost: {formatPrice(totalPurchaseBase)} · Claimable from CRA
        </p>
      </div>

      {/* HST Collected */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">HST Collected from Sales</p>
        <p className="text-2xl font-bold text-foreground mt-1">{formatPrice(totalHSTCollected)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Across {salesCount} taxable order{salesCount !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">Must be remitted to CRA</p>
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
        <p className="text-xs text-muted-foreground mt-1">
          {netHSTPosition > 0
            ? `Owing to CRA — remit ${formatPrice(netHSTPosition)}`
            : netHSTPosition < 0
              ? `Refund due — CRA owes ${formatPrice(Math.abs(netHSTPosition))}`
              : "Balanced — no amount owing"}
        </p>
      </div>
    </div>
  );
}
