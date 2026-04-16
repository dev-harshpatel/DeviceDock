"use client";

import { Calendar, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type Grade, GRADES, GRADE_LABELS } from "@/lib/constants/grades";
import { OrderStatus } from "@/types/order";

export interface ReportFilters {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  orderStatus: OrderStatus | "all";
  grade: Grade | "all";
  brand: string | "all";
}

interface ReportsFilterPanelProps {
  filters: ReportFilters;
  setFilters: React.Dispatch<React.SetStateAction<ReportFilters>>;
  availableBrands: string[];
  hasActiveFilters: boolean;
  onReset: () => void;
}

export function ReportsFilterPanel({
  filters,
  setFilters,
  availableBrands,
  hasActiveFilters,
  onReset,
}: ReportsFilterPanelProps) {
  return (
    <div className="bg-card rounded-lg border border-border shadow-soft p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters:</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground h-7 px-2"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Filter controls — 2-col grid on mobile, single flex row on sm+ */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
        {/* From date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[130px] h-9 justify-start text-left text-sm font-normal px-3",
                !filters.dateRange.from && "text-muted-foreground",
              )}
            >
              <Calendar className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {filters.dateRange.from ? format(filters.dateRange.from, "MMM dd, y") : "From"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              initialFocus
              mode="single"
              selected={filters.dateRange.from ?? undefined}
              onSelect={(day) =>
                setFilters((prev) => ({
                  ...prev,
                  dateRange: {
                    ...prev.dateRange,
                    from: day ?? null,
                    to:
                      prev.dateRange.to && day && day > prev.dateRange.to
                        ? null
                        : prev.dateRange.to,
                  },
                }))
              }
            />
          </PopoverContent>
        </Popover>

        {/* To date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[130px] h-9 justify-start text-left text-sm font-normal px-3",
                !filters.dateRange.to && "text-muted-foreground",
              )}
            >
              <Calendar className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {filters.dateRange.to ? format(filters.dateRange.to, "MMM dd, y") : "To"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              initialFocus
              mode="single"
              selected={filters.dateRange.to ?? undefined}
              disabled={filters.dateRange.from ? { before: filters.dateRange.from } : undefined}
              defaultMonth={filters.dateRange.from ?? undefined}
              onSelect={(day) =>
                setFilters((prev) => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, to: day ?? null },
                }))
              }
            />
          </PopoverContent>
        </Popover>

        {/* Order Status Filter */}
        <Select
          value={filters.orderStatus}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, orderStatus: value as OrderStatus | "all" }))
          }
        >
          <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
            <SelectValue placeholder="Order Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        {/* Grade Filter */}
        <Select
          value={filters.grade}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, grade: value as Grade | "all" }))
          }
        >
          <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {GRADE_LABELS[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Brand Filter */}
        <Select
          value={filters.brand}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, brand: value }))}
        >
          <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {availableBrands.map((brand) => (
              <SelectItem key={brand} value={brand}>
                {brand}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
