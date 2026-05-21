"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, Loader2, RotateCcw, Search, ShoppingBag } from "lucide-react";

interface OrdersHeaderProps {
  activeTab: "orders" | "deleted";
  totalCount: number;
  deletedTotal: number;
  hasActiveFilters: boolean;
  searchQuery: string;
  isPendingManualSale: boolean;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenManualSale: () => void;
  onResetFilter: () => void;
}

export function OrdersHeader({
  activeTab,
  totalCount,
  deletedTotal,
  hasActiveFilters,
  searchQuery,
  isPendingManualSale,
  onSearchChange,
  onOpenManualSale,
  onResetFilter,
}: OrdersHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border mb-4 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-3 lg:pt-4 pb-3">
      {/* Title row */}
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-2xl font-semibold text-foreground">Orders</h2>
        <p className="text-sm text-muted-foreground">
          {activeTab === "orders"
            ? `${totalCount} ${hasActiveFilters ? "filtered" : "total"} orders`
            : `${deletedTotal} deleted order${deletedTotal === 1 ? "" : "s"}`}
        </p>
      </div>

      {/* Tabs + controls on one row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <TabsList className="bg-muted/60 shrink-0 w-full sm:w-auto">
          <TabsTrigger value="orders" className="gap-2 flex-1 sm:flex-none">
            <ShoppingBag className="h-3.5 w-3.5" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="deleted" className="gap-2 flex-1 sm:flex-none">
            <Archive className="h-3.5 w-3.5" />
            Deleted Orders
            {deletedTotal > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[11px] font-semibold rounded-full"
              >
                {deletedTotal > 99 ? "99+" : deletedTotal}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Orders filters — only shown on orders tab */}
        {activeTab === "orders" && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID..."
                value={searchQuery}
                onChange={onSearchChange}
                className="pl-9 bg-background border-border"
              />
            </div>
            <Button
              type="button"
              onClick={onOpenManualSale}
              disabled={isPendingManualSale}
              className="gap-2 shrink-0"
              aria-busy={isPendingManualSale}
            >
              {isPendingManualSale ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              ) : (
                <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {isPendingManualSale ? "Opening…" : "Record Sale"}
              </span>
              <span className="sm:hidden">{isPendingManualSale ? "…" : "Sale"}</span>
            </Button>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResetFilter}
                className="border-border shrink-0"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
