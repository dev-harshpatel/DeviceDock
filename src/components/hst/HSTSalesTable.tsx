"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { format } from "date-fns";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { SalesHSTRow } from "@/types/hst";

const PAGE_SIZE = 10;

const formatPct = (v: number) => `${v.toFixed(2)}%`;

const parseDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

interface HSTSalesTableProps {
  salesHSTRows: SalesHSTRow[];
  avgPurchaseRate: number;
}

export function HSTSalesTable({ salesHSTRows, avgPurchaseRate }: HSTSalesTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filteredRows = search.trim()
    ? salesHSTRows.filter((r) =>
        (r.invoiceNumber ?? r.id).toLowerCase().includes(search.toLowerCase()),
      )
    : salesHSTRows;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filteredTotal = filteredRows.reduce((sum, r) => sum + r.hstCollected, 0);

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-soft p-6 flex flex-col">
      <h3 className="font-semibold text-foreground mb-3">HST Collected from Sales</h3>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search order or invoice #…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {salesHSTRows.length > 0 ? (
        <div className="flex flex-col flex-1">
          <div className="overflow-x-auto flex-1 min-h-[360px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 text-muted-foreground font-medium">Order</th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">Subtotal</th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">Rate</th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">
                    HST Collected
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length > 0 ? (
                  pageRows.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-foreground">
                        <div className="font-medium">
                          {row.invoiceNumber ?? `#${row.id.slice(-8).toUpperCase()}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {parseDate(row.date) ? format(parseDate(row.date)!, "MMM dd, yyyy") : "—"}
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
                    <td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">
                      No orders match your search
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredRows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {filteredRows.length} orders
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-3 mt-3 border-t border-border">
            <span className="text-sm font-semibold text-foreground">
              Total Collected
              {search.trim() && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(filtered)</span>
              )}
            </span>
            <span className="text-sm font-bold text-foreground">{formatPrice(filteredTotal)}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No taxable orders in selected period
        </div>
      )}
    </div>
  );
}
