import { AlertCircle } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { SalesHSTRow } from "@/types/hst";

const formatPct = (v: number) => `${v.toFixed(2)}%`;

interface PurchaseRateRow {
  rate: number;
  count: number;
  baseAmount: number;
  hstAmount: number;
}

interface SalesRateRow {
  rate: number;
  count: number;
  subtotal: number;
  hstAmount: number;
}

interface HSTRateBreakdownProps {
  purchaseRateBreakdown: PurchaseRateRow[];
  salesRateBreakdown: SalesRateRow[];
  avgPurchaseRate: number;
  totalHSTPaid: number;
  totalHSTCollected: number;
  rateMismatches: SalesHSTRow[];
}

export function HSTRateBreakdown({
  purchaseRateBreakdown,
  salesRateBreakdown,
  avgPurchaseRate,
  totalHSTPaid,
  totalHSTCollected,
  rateMismatches,
}: HSTRateBreakdownProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Purchase HST by Rate */}
        <div className="bg-card rounded-lg border border-border shadow-soft p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Purchase HST by Rate</h3>
          {purchaseRateBreakdown.length > 0 ? (
            <div className="space-y-2">
              {purchaseRateBreakdown.map((row) => (
                <div key={row.rate} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {formatPct(row.rate)}
                    </span>
                    <span className="text-muted-foreground">
                      {row.count} item{row.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-foreground">
                      {formatPrice(row.hstAmount)}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      on {formatPrice(row.baseAmount)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                <span className="text-foreground">Total ITCs</span>
                <span className="text-foreground">{formatPrice(totalHSTPaid)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No purchase data with HST</p>
          )}
        </div>

        {/* Sales HST by Rate */}
        <div className="bg-card rounded-lg border border-border shadow-soft p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Sales HST by Rate</h3>
          {salesRateBreakdown.length > 0 ? (
            <div className="space-y-2">
              {salesRateBreakdown.map((row) => (
                <div key={row.rate} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        row.rate >= avgPurchaseRate
                          ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                      )}
                    >
                      {formatPct(row.rate)}
                    </span>
                    <span className="text-muted-foreground">
                      {row.count} order{row.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-foreground">
                      {formatPrice(row.hstAmount)}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      on {formatPrice(row.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                <span className="text-foreground">Total Collected</span>
                <span className="text-foreground">{formatPrice(totalHSTCollected)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No taxable orders found</p>
          )}
        </div>
      </div>

      {rateMismatches.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {rateMismatches.length} order{rateMismatches.length !== 1 ? "s" : ""} collected HST
                below your avg purchase rate ({formatPct(avgPurchaseRate)})
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                These customers were charged a lower tax rate than the HST you paid on the purchase.
                This is typical for cross-province sales (e.g., selling to Alberta at 5% GST vs
                Ontario 13% HST) and is favorable — it reduces your net remittance to CRA.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
