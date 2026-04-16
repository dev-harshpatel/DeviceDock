"use client";

import { Calendar, Filter, X } from "lucide-react";
import { Info } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface HSTFilterBarProps {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  hasActiveFilters: boolean;
}

export function HSTFilterBar({ dateRange, setDateRange, hasActiveFilters }: HSTFilterBarProps) {
  return (
    <div className="bg-card rounded-lg border border-border shadow-soft p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 flex-1">
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
                  setDateRange({ from: range?.from ?? null, to: range?.to ?? null })
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
      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        Purchase dates are based on last restock date. Order dates use actual order creation date.
      </p>
    </div>
  );
}
