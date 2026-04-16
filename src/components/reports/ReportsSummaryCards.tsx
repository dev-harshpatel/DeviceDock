import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SummaryStats {
  totalRevenue: number;
  totalOrders: number;
  totalUnits: number;
}

interface EstimatedProfitStats {
  totalProfit: number;
  itemsWithData: number;
}

interface ProfitFromOrdersStats {
  totalProfit: number;
  orderCount: number;
  periodLabel: string;
}

interface ReportsSummaryCardsProps {
  summaryStats: SummaryStats;
  estimatedProfitStats: EstimatedProfitStats;
  isEstimatedProfitPending: boolean;
  profitFromOrdersStats: ProfitFromOrdersStats;
  /** Whether a date range is active (controls "in selected range" label) */
  hasSummaryDateRange: boolean;
  completedOrdersCount: number;
  filteredInventoryCount: number;
  filteredInventoryTotalUnits: number;
}

export function ReportsSummaryCards({
  summaryStats,
  estimatedProfitStats,
  isEstimatedProfitPending,
  profitFromOrdersStats,
  hasSummaryDateRange,
  completedOrdersCount,
  filteredInventoryCount,
  filteredInventoryTotalUnits,
}: ReportsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">Total Revenue</p>
        <p className="text-2xl font-bold text-foreground mt-1">
          {formatPrice(summaryStats.totalRevenue)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {completedOrdersCount} completed orders
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">Estimated Profit</p>
        <p
          className={cn(
            "text-2xl font-bold mt-1",
            estimatedProfitStats.totalProfit >= 0 ? "text-success" : "text-destructive",
          )}
        >
          {isEstimatedProfitPending
            ? "Calculating..."
            : formatPrice(estimatedProfitStats.totalProfit)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          (Selling − Cost/unit) × Qty · Excl. HST ·{" "}
          {isEstimatedProfitPending ? "…" : estimatedProfitStats.itemsWithData} items
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">{profitFromOrdersStats.periodLabel}</p>
        <p
          className={cn(
            "text-2xl font-bold mt-1",
            profitFromOrdersStats.totalProfit >= 0 ? "text-success" : "text-destructive",
          )}
        >
          {formatPrice(profitFromOrdersStats.totalProfit)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          From {profitFromOrdersStats.orderCount} completed orders
          {hasSummaryDateRange && <> in selected range</>}
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">Total Orders</p>
        <p className="text-2xl font-bold text-foreground mt-1">{summaryStats.totalOrders}</p>
        <p className="text-xs text-muted-foreground mt-1">{summaryStats.totalUnits} total units</p>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <p className="text-sm text-muted-foreground">Inventory Items</p>
        <p className="text-2xl font-bold text-foreground mt-1">{filteredInventoryCount}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {filteredInventoryTotalUnits} total units
        </p>
      </div>
    </div>
  );
}
