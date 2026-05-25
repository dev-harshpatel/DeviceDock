"use client";

import { AlertCircle } from "lucide-react";
import { AdminHSTSkeleton } from "@/components/skeletons/AdminHSTSkeleton";
import { HSTFilterBar } from "@/components/hst/HSTFilterBar";
import { HSTSummaryCards } from "@/components/hst/HSTSummaryCards";
import { HSTRateBreakdown } from "@/components/hst/HSTRateBreakdown";
import { HSTPurchaseTable } from "@/components/hst/HSTPurchaseTable";
import { HSTSalesTable } from "@/components/hst/HSTSalesTable";
import { HSTTimelineSection } from "@/components/hst/HSTTimelineSection";
import { useHSTReconciliation } from "@/hooks/use-hst-reconciliation";

export default function HSTReconciliation() {
  const {
    dateRange,
    setDateRange,
    hasActiveFilters,
    isPageLoading,
    purchaseHSTRows,
    totalHSTPaid,
    totalPurchaseBase,
    hasMissingPurchaseBaseForItc,
    salesHSTRows,
    totalHSTCollected,
    totalSalesSubtotal,
    itcEffectivePercent,
    collectedEffectivePercent,
    netHSTPosition,
    purchaseRateBreakdown,
    salesRateBreakdown,
    avgPurchaseRate,
    rateMismatches,
    totalRateBenchmarkSaving,
    timelineData,
  } = useHSTReconciliation();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-6 pb-6">
        {isPageLoading ? (
          <AdminHSTSkeleton />
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">HST Reconciliation</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Net remittance is a <span className="text-foreground font-medium">dollar</span>{" "}
                amount: HST collected on sales minus input tax credits (ITCs) on purchases. It is
                not a simple “rate gap” (for example 13% vs 10%). Purchase ITCs use each inventory
                row’s{" "}
                <span className="text-foreground font-medium">tax-exclusive Purchase Price</span> ×
                HST %.
              </p>
            </div>

            {hasMissingPurchaseBaseForItc && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Purchase base missing for ITCs
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      At least one inventory item has an HST rate but Purchase Price (tax-exclusive
                      batch cost) is empty or zero. ITCs are calculated as Purchase Price × HST%, so
                      credits show $0 until you enter the correct purchase base on those products.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <HSTFilterBar
              dateRange={dateRange}
              setDateRange={setDateRange}
              hasActiveFilters={hasActiveFilters}
            />

            <HSTSummaryCards
              totalHSTPaid={totalHSTPaid}
              totalHSTCollected={totalHSTCollected}
              netHSTPosition={netHSTPosition}
              purchaseCount={purchaseHSTRows.length}
              salesCount={salesHSTRows.length}
              totalPurchaseBase={totalPurchaseBase}
              totalSalesSubtotal={totalSalesSubtotal}
              itcEffectivePercent={itcEffectivePercent}
              collectedEffectivePercent={collectedEffectivePercent}
              avgPurchaseRate={avgPurchaseRate}
              totalRateBenchmarkSaving={totalRateBenchmarkSaving}
            />

            <HSTRateBreakdown
              purchaseRateBreakdown={purchaseRateBreakdown}
              salesRateBreakdown={salesRateBreakdown}
              avgPurchaseRate={avgPurchaseRate}
              totalHSTPaid={totalHSTPaid}
              totalHSTCollected={totalHSTCollected}
              rateMismatches={rateMismatches}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HSTPurchaseTable purchaseHSTRows={purchaseHSTRows} />
              <HSTSalesTable salesHSTRows={salesHSTRows} avgPurchaseRate={avgPurchaseRate} />
            </div>

            <HSTTimelineSection
              timelineData={timelineData}
              rateMismatches={rateMismatches}
              avgPurchaseRate={avgPurchaseRate}
            />
          </>
        )}
      </div>
    </div>
  );
}
