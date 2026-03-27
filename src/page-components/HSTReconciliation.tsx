"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { formatPrice } from "@/lib/utils";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  AlertCircle,
  Info,
  Search,
} from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AdminHSTSkeleton } from "@/components/skeletons/AdminHSTSkeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const formatPct = (v: number) => `${v.toFixed(2)}%`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseHSTRow {
  id: string;
  deviceName: string;
  brand: string;
  quantity: number;
  purchasePrice: number;
  hstRate: number;
  hstAmount: number;
  totalWithHST: number;
  date: string;
}

interface SalesHSTRow {
  id: string;
  invoiceNumber: string | null | undefined;
  subtotal: number;
  taxRate: number;
  taxRatePercent: number;
  hstCollected: number;
  date: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HSTReconciliation() {
  const { inventory, isLoading: inventoryLoading } = useInventory();
  const { orders, isLoading: ordersLoading } = useOrders();

  const [dateRange, setDateRange] = useState<{
    from: Date | null;
    to: Date | null;
  }>({ from: null, to: null });

  const hasActiveFilters = dateRange.from !== null || dateRange.to !== null;
  const isPageLoading = inventoryLoading || ordersLoading;

  // ── Table search + pagination state ───────────────────────────────────────
  const PAGE_SIZE = 10;
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchasePage, setPurchasePage] = useState(1);
  const [salesSearch, setSalesSearch] = useState("");
  const [salesPage, setSalesPage] = useState(1);

  const handlePurchaseSearch = (q: string) => {
    setPurchaseSearch(q);
    setPurchasePage(1);
  };
  const handleSalesSearch = (q: string) => {
    setSalesSearch(q);
    setSalesPage(1);
  };

  // Helper: parse a date string safely (returns null for empty/invalid values)
  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Helper: check if a date string falls within the selected range
  const inRange = (dateStr: string | null | undefined): boolean => {
    if (!dateRange.from && !dateRange.to) return true;
    const d = parseDate(dateStr);
    if (!d) return false; // exclude items with no valid date when a range is active
    if (dateRange.from && d < dateRange.from) return false;
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  };

  // ── HST Paid on Purchases (Input Tax Credits) ──────────────────────────────
  // purchasePrice = total base cost for the full batch, EXCLUDING HST
  // hst = HST percentage (e.g. 13 for 13%)
  // HST paid = purchasePrice × (hst / 100)
  const purchaseHSTRows = useMemo<PurchaseHSTRow[]>(() => {
    return inventory
      .filter(
        (item) =>
          item.purchasePrice != null &&
          item.hst != null &&
          item.hst > 0 &&
          inRange(item.lastUpdated),
      )
      .map((item) => ({
        id: item.id,
        deviceName: item.deviceName,
        brand: item.brand,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice!,
        hstRate: item.hst!,
        hstAmount: (item.purchasePrice! * item.hst!) / 100,
        totalWithHST: item.purchasePrice! * (1 + item.hst! / 100),
        date: item.lastUpdated,
      }));
  }, [inventory, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalHSTPaid = useMemo(
    () => purchaseHSTRows.reduce((sum, r) => sum + r.hstAmount, 0),
    [purchaseHSTRows],
  );
  const totalPurchaseBase = useMemo(
    () => purchaseHSTRows.reduce((sum, r) => sum + r.purchasePrice, 0),
    [purchaseHSTRows],
  );

  // ── HST Collected from Sales (Output Tax) ─────────────────────────────────
  // Only count approved / completed orders
  // taxRate is a decimal (0.13 = 13%); taxAmount is the actual $ HST
  const salesHSTRows = useMemo<SalesHSTRow[]>(() => {
    return orders
      .filter(
        (o) =>
          (o.status === "approved" || o.status === "completed") &&
          ((o.taxRate != null && o.taxRate > 0) || (o.taxAmount != null && o.taxAmount > 0)) &&
          inRange(o.createdAt),
      )
      .map((order) => {
        const subtotal = order.subtotal ?? 0;
        const taxRate = order.taxRate ?? 0;
        const hstCollected = order.taxAmount ?? subtotal * taxRate;
        return {
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          subtotal,
          taxRate,
          taxRatePercent: taxRate * 100,
          hstCollected,
          date: order.createdAt,
        };
      });
  }, [orders, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalHSTCollected = useMemo(
    () => salesHSTRows.reduce((sum, r) => sum + r.hstCollected, 0),
    [salesHSTRows],
  );

  // ── Net HST Position ───────────────────────────────────────────────────────
  // Positive = you owe CRA (collected more than paid)
  // Negative = CRA owes you a refund (paid more than collected)
  const netHSTPosition = totalHSTCollected - totalHSTPaid;

  // ── Rate Breakdown for Purchases ──────────────────────────────────────────
  const purchaseRateBreakdown = useMemo(() => {
    const map = new Map<number, { count: number; baseAmount: number; hstAmount: number }>();
    purchaseHSTRows.forEach((r) => {
      const existing = map.get(r.hstRate) ?? {
        count: 0,
        baseAmount: 0,
        hstAmount: 0,
      };
      existing.count += 1;
      existing.baseAmount += r.purchasePrice;
      existing.hstAmount += r.hstAmount;
      map.set(r.hstRate, existing);
    });
    return Array.from(map.entries())
      .map(([rate, data]) => ({ rate, ...data }))
      .sort((a, b) => b.rate - a.rate);
  }, [purchaseHSTRows]);

  // ── Rate Breakdown for Sales ───────────────────────────────────────────────
  const salesRateBreakdown = useMemo(() => {
    const map = new Map<number, { count: number; subtotal: number; hstAmount: number }>();
    salesHSTRows.forEach((r) => {
      const key = Math.round(r.taxRatePercent * 100) / 100; // round to 2dp
      const existing = map.get(key) ?? {
        count: 0,
        subtotal: 0,
        hstAmount: 0,
      };
      existing.count += 1;
      existing.subtotal += r.subtotal;
      existing.hstAmount += r.hstCollected;
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([rate, data]) => ({ rate, ...data }))
      .sort((a, b) => b.rate - a.rate);
  }, [salesHSTRows]);

  // ── Avg purchase HST rate (for mismatch analysis) ─────────────────────────
  const avgPurchaseRate =
    purchaseRateBreakdown.length > 0
      ? purchaseRateBreakdown.reduce((sum, r) => sum + r.rate * r.baseAmount, 0) /
        (totalPurchaseBase || 1)
      : 13;

  // ── Rate Mismatch: orders charged less than avg purchase rate ─────────────
  const rateMismatches = useMemo(
    () => salesHSTRows.filter((r) => r.taxRatePercent > 0 && r.taxRatePercent < avgPurchaseRate),
    [salesHSTRows, avgPurchaseRate],
  );

  // ── HST Timeline Chart (group by month) ───────────────────────────────────
  const timelineData = useMemo(() => {
    const byMonth = new Map<string, { hstPaid: number; hstCollected: number }>();

    purchaseHSTRows.forEach((r) => {
      const d = parseDate(r.date);
      if (!d) return;
      const key = format(d, "MMM yyyy");
      const existing = byMonth.get(key) ?? { hstPaid: 0, hstCollected: 0 };
      existing.hstPaid += r.hstAmount;
      byMonth.set(key, existing);
    });

    salesHSTRows.forEach((r) => {
      const d = parseDate(r.date);
      if (!d) return;
      const key = format(d, "MMM yyyy");
      const existing = byMonth.get(key) ?? { hstPaid: 0, hstCollected: 0 };
      existing.hstCollected += r.hstCollected;
      byMonth.set(key, existing);
    });

    return Array.from(byMonth.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => {
        const aDate = new Date("1 " + a.period);
        const bDate = new Date("1 " + b.period);
        return aDate.getTime() - bDate.getTime();
      });
  }, [purchaseHSTRows, salesHSTRows]);

  // ── Filtered + paginated rows for the detail tables ──────────────────────
  const filteredPurchaseRows = useMemo(() => {
    const q = purchaseSearch.trim().toLowerCase();
    if (!q) return purchaseHSTRows;
    return purchaseHSTRows.filter(
      (r) => r.deviceName.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q),
    );
  }, [purchaseHSTRows, purchaseSearch]);

  const purchaseTotalPages = Math.max(1, Math.ceil(filteredPurchaseRows.length / PAGE_SIZE));
  const purchasePageRows = filteredPurchaseRows.slice(
    (purchasePage - 1) * PAGE_SIZE,
    purchasePage * PAGE_SIZE,
  );
  const filteredPurchaseTotal = filteredPurchaseRows.reduce((sum, r) => sum + r.hstAmount, 0);

  const filteredSalesRows = useMemo(() => {
    const q = salesSearch.trim().toLowerCase();
    if (!q) return salesHSTRows;
    return salesHSTRows.filter((r) => (r.invoiceNumber ?? r.id).toLowerCase().includes(q));
  }, [salesHSTRows, salesSearch]);

  const salesTotalPages = Math.max(1, Math.ceil(filteredSalesRows.length / PAGE_SIZE));
  const salesPageRows = filteredSalesRows.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);
  const filteredSalesTotal = filteredSalesRows.reduce((sum, r) => sum + r.hstCollected, 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-6 pb-6">
        {isPageLoading ? (
          <AdminHSTSkeleton />
        ) : (
          <>
            {/* Page Header */}
            <div>
              <h2 className="text-2xl font-semibold text-foreground">HST Reconciliation</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Track HST paid on purchases (Input Tax Credits) vs HST collected from sales, and
                calculate your net CRA remittance position.
              </p>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-lg border border-border shadow-soft p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Filters:</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  {/* Date Range */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full sm:w-[240px] justify-start text-left font-normal",
                          !dateRange.from && "text-muted-foreground",
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} &ndash;{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange.from || new Date()}
                        selected={{
                          from: dateRange.from ?? undefined,
                          to: dateRange.to ?? undefined,
                        }}
                        onSelect={(range) =>
                          setDateRange({
                            from: range?.from ?? null,
                            to: range?.to ?? null,
                          })
                        }
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: null, to: null })}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              {/* Date note */}
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                Purchase dates are based on last restock date. Order dates use actual order creation
                date.
              </p>
            </div>

            {/* ── Summary Cards ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* HST Paid (ITCs) */}
              <div className="bg-card rounded-lg border border-border shadow-soft p-4">
                <p className="text-sm text-muted-foreground">HST Input Tax Credits</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatPrice(totalHSTPaid)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Paid on {purchaseHSTRows.length} inventory purchase
                  {purchaseHSTRows.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Base cost: {formatPrice(totalPurchaseBase)} · Claimable from CRA
                </p>
              </div>

              {/* HST Collected */}
              <div className="bg-card rounded-lg border border-border shadow-soft p-4">
                <p className="text-sm text-muted-foreground">HST Collected from Sales</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatPrice(totalHSTCollected)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {salesHSTRows.length} taxable order
                  {salesHSTRows.length !== 1 ? "s" : ""}
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

            {/* ── Rate Summary Strips ───────────────────────────────────────────── */}
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

            {/* ── Rate Mismatch Alert ───────────────────────────────────────────── */}
            {rateMismatches.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {rateMismatches.length} order
                      {rateMismatches.length !== 1 ? "s" : ""} collected HST below your avg purchase
                      rate ({formatPct(avgPurchaseRate)})
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      These customers were charged a lower tax rate than the HST you paid on the
                      purchase. This is typical for cross-province sales (e.g., selling to Alberta
                      at 5% GST vs Ontario 13% HST) and is favorable — it reduces your net
                      remittance to CRA.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Detailed Tables ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* HST Paid — Inventory Table */}
              <div className="bg-card rounded-lg border border-border shadow-soft p-6 flex flex-col">
                <h3 className="font-semibold text-foreground mb-3">HST Paid on Purchases (ITCs)</h3>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search device or brand…"
                    value={purchaseSearch}
                    onChange={(e) => handlePurchaseSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {purchaseHSTRows.length > 0 ? (
                  <div className="flex flex-col flex-1">
                    {/* Table */}
                    <div className="overflow-x-auto flex-1 min-h-[360px]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left pb-2 text-muted-foreground font-medium">
                              Device
                            </th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">
                              Qty
                            </th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">
                              Base Cost
                            </th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">
                              Rate
                            </th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">
                              HST Paid
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchasePageRows.length > 0 ? (
                            purchasePageRows.map((row) => (
                              <tr key={row.id} className="border-b border-border/50 last:border-0">
                                <td className="py-2 text-foreground">
                                  <TooltipProvider delayDuration={300}>
                                    <UITooltip>
                                      <TooltipTrigger asChild>
                                        <div className="font-medium truncate max-w-[130px] cursor-default">
                                          {row.deviceName}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">{row.deviceName}</TooltipContent>
                                    </UITooltip>
                                  </TooltipProvider>
                                  <div className="text-xs text-muted-foreground">{row.brand}</div>
                                </td>
                                <td className="py-2 text-right text-foreground">{row.quantity}</td>
                                <td className="py-2 text-right text-foreground">
                                  {formatPrice(row.purchasePrice)}
                                </td>
                                <td className="py-2 text-right">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    {formatPct(row.hstRate)}
                                  </span>
                                </td>
                                <td className="py-2 text-right font-medium text-foreground">
                                  {formatPrice(row.hstAmount)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-6 text-center text-muted-foreground text-sm"
                              >
                                No items match your search
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {filteredPurchaseRows.length > PAGE_SIZE && (
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">
                          Page {purchasePage} of {purchaseTotalPages} ·{" "}
                          {filteredPurchaseRows.length} items
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPurchasePage((p) => Math.max(1, p - 1))}
                            disabled={purchasePage === 1}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setPurchasePage((p) => Math.min(purchaseTotalPages, p + 1))
                            }
                            disabled={purchasePage === purchaseTotalPages}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pinned total — always visible */}
                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-border">
                      <span className="text-sm font-semibold text-foreground">
                        Total ITC
                        {purchaseSearch.trim() && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (filtered)
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {formatPrice(filteredPurchaseTotal)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No purchase data with HST available
                  </div>
                )}
              </div>

              {/* HST Collected — Orders Table */}
              <div className="bg-card rounded-lg border border-border shadow-soft p-6 flex flex-col">
                <h3 className="font-semibold text-foreground mb-3">HST Collected from Sales</h3>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search order or invoice #…"
                    value={salesSearch}
                    onChange={(e) => handleSalesSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {salesHSTRows.length > 0 ? (
                  <div className="flex flex-col flex-1">
                    {/* Table */}
                    <div className="overflow-x-auto flex-1 min-h-[360px]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left pb-2 text-muted-foreground font-medium">
                              Order
                            </th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">
                              Subtotal
                            </th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">
                              Rate
                            </th>
                            <th className="text-right pb-2 text-muted-foreground font-medium">
                              HST Collected
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesPageRows.length > 0 ? (
                            salesPageRows.map((row) => (
                              <tr key={row.id} className="border-b border-border/50 last:border-0">
                                <td className="py-2 text-foreground">
                                  <div className="font-medium">
                                    {row.invoiceNumber ?? `#${row.id.slice(-8).toUpperCase()}`}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {parseDate(row.date)
                                      ? format(parseDate(row.date)!, "MMM dd, yyyy")
                                      : "—"}
                                  </div>
                                </td>
                                <td className="py-2 text-right text-foreground">
                                  {formatPrice(row.subtotal)}
                                </td>
                                <td className="py-2 text-right">
                                  <span
                                    className={cn(
                                      "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
                                      row.taxRatePercent >= avgPurchaseRate
                                        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                                    )}
                                  >
                                    {formatPct(row.taxRatePercent)}
                                  </span>
                                </td>
                                <td className="py-2 text-right font-medium text-foreground">
                                  {formatPrice(row.hstCollected)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="py-6 text-center text-muted-foreground text-sm"
                              >
                                No orders match your search
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {filteredSalesRows.length > PAGE_SIZE && (
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">
                          Page {salesPage} of {salesTotalPages} · {filteredSalesRows.length} orders
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
                            disabled={salesPage === 1}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))}
                            disabled={salesPage === salesTotalPages}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pinned total — always visible */}
                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-border">
                      <span className="text-sm font-semibold text-foreground">
                        Total Collected
                        {salesSearch.trim() && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (filtered)
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {formatPrice(filteredSalesTotal)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No taxable orders in selected period
                  </div>
                )}
              </div>
            </div>

            {/* ── HST Timeline Chart ────────────────────────────────────────────── */}
            {timelineData.length > 0 && (
              <div className="bg-card rounded-lg border border-border shadow-soft p-6">
                <h3 className="font-semibold text-foreground mb-1">
                  HST Paid vs Collected by Period
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Compare your Input Tax Credits (paid on purchases) with HST collected from sales
                  over time.
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                      />
                      <Tooltip
                        formatter={(value: number) => formatPrice(value)}
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend />
                      <Bar
                        dataKey="hstPaid"
                        name="HST Paid (ITC)"
                        fill="hsl(217, 91%, 60%)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="hstCollected"
                        name="HST Collected"
                        fill="hsl(142, 76%, 36%)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Rate Difference Analysis ──────────────────────────────────────── */}
            {rateMismatches.length > 0 && (
              <div className="bg-card rounded-lg border border-border shadow-soft p-6">
                <h3 className="font-semibold text-foreground mb-1">Rate Difference Analysis</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Orders where the applied tax rate was below your average purchase HST rate of{" "}
                  <span className="font-medium text-foreground">{formatPct(avgPurchaseRate)}</span>.
                  A lower collected rate means less remittance to CRA.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left pb-2 text-muted-foreground font-medium">Order</th>
                        <th className="text-right pb-2 text-muted-foreground font-medium">
                          Subtotal
                        </th>
                        <th className="text-right pb-2 text-muted-foreground font-medium">
                          Applied Rate
                        </th>
                        <th className="text-right pb-2 text-muted-foreground font-medium">
                          HST Collected
                        </th>
                        <th className="text-right pb-2 text-muted-foreground font-medium">
                          At {formatPct(avgPurchaseRate)}
                        </th>
                        <th className="text-right pb-2 text-muted-foreground font-medium">
                          Saving
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateMismatches.map((row) => {
                        const atStdRate = row.subtotal * (avgPurchaseRate / 100);
                        const saving = atStdRate - row.hstCollected;
                        return (
                          <tr key={row.id} className="border-b border-border/50 last:border-0">
                            <td className="py-2 text-foreground">
                              <div className="font-medium">
                                {row.invoiceNumber ?? `#${row.id.slice(-8).toUpperCase()}`}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {parseDate(row.date)
                                  ? format(parseDate(row.date)!, "MMM dd, yyyy")
                                  : "—"}
                              </div>
                            </td>
                            <td className="py-2 text-right text-foreground">
                              {formatPrice(row.subtotal)}
                            </td>
                            <td className="py-2 text-right">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                {formatPct(row.taxRatePercent)}
                              </span>
                            </td>
                            <td className="py-2 text-right text-foreground">
                              {formatPrice(row.hstCollected)}
                            </td>
                            <td className="py-2 text-right text-muted-foreground">
                              {formatPrice(atStdRate)}
                            </td>
                            <td className="py-2 text-right font-medium text-success">
                              -{formatPrice(saving)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td className="pt-2 text-muted-foreground text-xs" colSpan={6}>
                          "Saving" = reduction in your CRA remittance vs if all sales were at{" "}
                          {formatPct(avgPurchaseRate)} HST
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
