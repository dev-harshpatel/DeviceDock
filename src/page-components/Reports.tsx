"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminReportsSkeleton } from "@/components/skeletons/AdminReportsSkeleton";
import { ReportsFilterPanel } from "@/components/reports/ReportsFilterPanel";
import { ReportsSummaryCards } from "@/components/reports/ReportsSummaryCards";
import { ReportsChartsGrid } from "@/components/reports/ReportsChartsGrid";
import { useReportsManagement } from "@/hooks/use-reports-management";

export default function Reports() {
  const {
    filters,
    setFilters,
    trendGrouping,
    availableBrands,
    filteredInventory,
    trendData,
    stockByGrade,
    stockByStatus,
    valueByDevice,
    orderStatusDistribution,
    revenueByStatus,
    summaryStats,
    estimatedProfitStats,
    isEstimatedProfitPending,
    profitFromOrdersStats,
    hasActiveFilters,
    resetFilters,
    isPageLoading,
    completedOrdersCount,
    filteredInventoryTotalUnits,
  } = useReportsManagement();

  if (isPageLoading) return <AdminReportsSkeleton />;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-6 pb-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Reports</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Analytics and insights for your inventory and orders
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </div>

        <ReportsFilterPanel
          filters={filters}
          setFilters={setFilters}
          availableBrands={availableBrands}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />

        <ReportsSummaryCards
          summaryStats={summaryStats}
          estimatedProfitStats={estimatedProfitStats}
          isEstimatedProfitPending={isEstimatedProfitPending}
          profitFromOrdersStats={profitFromOrdersStats}
          hasSummaryDateRange={filters.dateRange.from != null && filters.dateRange.to != null}
          completedOrdersCount={completedOrdersCount}
          filteredInventoryCount={filteredInventory.length}
          filteredInventoryTotalUnits={filteredInventoryTotalUnits}
        />

        <ReportsChartsGrid
          trendData={trendData}
          trendGrouping={trendGrouping}
          hasDateRangeFrom={filters.dateRange.from != null}
          valueByDevice={valueByDevice}
          stockByGrade={stockByGrade}
          stockByStatus={stockByStatus}
          orderStatusDistribution={orderStatusDistribution}
          revenueByStatus={revenueByStatus}
        />
      </div>
    </div>
  );
}
