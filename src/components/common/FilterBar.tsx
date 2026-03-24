import { useState } from "react";
import { createPortal } from "react-dom";
import { Search, Filter, X, RotateCcw } from "lucide-react";
import { GRADES, GRADE_LABELS } from "@/lib/constants/grades";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterValues {
  search: string;
  brand: string;
  grade: string;
  storage: string;
  priceRange: string;
  stockStatus: string;
}

export const defaultFilters: FilterValues = {
  search: "",
  brand: "all",
  grade: "all",
  storage: "all",
  priceRange: "all",
  stockStatus: "all",
};

export function buildServerFilters(
  debouncedSearch: string,
  filters: FilterValues
): FilterValues {
  return { ...filters, search: debouncedSearch };
}

interface FilterBarProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onReset: () => void;
  className?: string;
  brands?: string[]; // Dynamic brands from inventory
  storageOptions?: string[]; // Dynamic storage options from inventory
  trailing?: React.ReactNode; // Extra buttons to render at the end (desktop only)
}

export function FilterBar({
  filters,
  onFiltersChange,
  onReset,
  className,
  brands = [],
  storageOptions = [],
  trailing,
}: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleChange = (key: keyof FilterValues, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters =
    filters.search ||
    filters.brand !== "all" ||
    filters.grade !== "all" ||
    filters.storage !== "all" ||
    filters.priceRange !== "all" ||
    filters.stockStatus !== "all";

  return (
    <>
      {/* Desktop Filter Bar — lg+ to match table breakpoint */}
      <div
        className={cn(
          "hidden lg:flex items-center gap-2 flex-wrap",
          className
        )}
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search device name..."
            value={filters.search}
            onChange={(e) => handleChange("search", e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>

        <Select
          value={filters.brand}
          onValueChange={(v) => handleChange("brand", v)}
        >
          <SelectTrigger
            className="w-[130px] bg-background border-border"
            aria-label="Filter by brand"
          >
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-[300px] overflow-y-auto">
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand} value={brand}>
                {brand}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.grade}
          onValueChange={(v) => handleChange("grade", v)}
        >
          <SelectTrigger
            className="w-[160px] bg-background border-border"
            aria-label="Filter by grade"
          >
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Grades</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {GRADE_LABELS[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.storage}
          onValueChange={(v) => handleChange("storage", v)}
        >
          <SelectTrigger
            className="w-[130px] bg-background border-border"
            aria-label="Filter by storage"
          >
            <SelectValue placeholder="Storage" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-[300px] overflow-y-auto">
            <SelectItem value="all">All Storage</SelectItem>
            {storageOptions.map((storage) => (
              <SelectItem key={storage} value={storage}>
                {storage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priceRange}
          onValueChange={(v) => handleChange("priceRange", v)}
        >
          <SelectTrigger
            className="w-[140px] bg-background border-border"
            aria-label="Filter by price range"
          >
            <SelectValue placeholder="Price Range" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Prices</SelectItem>
            <SelectItem value="under200">Under $200</SelectItem>
            <SelectItem value="200-400">$200 – $400</SelectItem>
            <SelectItem value="400+">$400+</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.stockStatus}
          onValueChange={(v) => handleChange("stockStatus", v)}
        >
          <SelectTrigger
            className="w-[140px] bg-background border-border"
            aria-label="Filter by stock status"
          >
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in-stock">In Stock</SelectItem>
            <SelectItem value="low-stock">Low Stock</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="border-border"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          {trailing}
        </div>
      </div>

      {/* Mobile / Tablet Filter — shown below lg */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search device name..."
              value={filters.search}
              onChange={(e) => handleChange("search", e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMobileOpen(true)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile Filter Modal */}
        {mobileOpen && createPortal(
          <div className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-sm">
            <div className="fixed inset-x-0 bottom-0 z-[201] bg-card border-t border-border rounded-t-xl flex flex-col max-h-[85vh] animate-fade-in">
              {/* Header — never scrolls */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                <h3 className="text-lg font-semibold">Filters</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Scrollable filter list */}
              <div className="overflow-y-auto flex-1 min-h-0 px-6 space-y-4 pb-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Brand
                  </label>
                  <Select
                    value={filters.brand}
                    onValueChange={(v) => handleChange("brand", v)}
                  >
                    <SelectTrigger
                      className="w-full bg-background border-border"
                      aria-label="Filter by brand"
                    >
                      <SelectValue placeholder="Brand" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-[300px] overflow-y-auto">
                      <SelectItem value="all">All Brands</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Grade
                  </label>
                  <Select
                    value={filters.grade}
                    onValueChange={(v) => handleChange("grade", v)}
                  >
                    <SelectTrigger
                      className="w-full bg-background border-border"
                      aria-label="Filter by grade"
                    >
                      <SelectValue placeholder="Grade" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="all">All Grades</SelectItem>
                      {GRADES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {GRADE_LABELS[g]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Storage
                  </label>
                  <Select
                    value={filters.storage}
                    onValueChange={(v) => handleChange("storage", v)}
                  >
                    <SelectTrigger
                      className="w-full bg-background border-border"
                      aria-label="Filter by storage"
                    >
                      <SelectValue placeholder="Storage" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-[300px] overflow-y-auto">
                      <SelectItem value="all">All Storage</SelectItem>
                      {storageOptions.map((storage) => (
                        <SelectItem key={storage} value={storage}>
                          {storage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Price Range
                  </label>
                  <Select
                    value={filters.priceRange}
                    onValueChange={(v) => handleChange("priceRange", v)}
                  >
                    <SelectTrigger
                      className="w-full bg-background border-border"
                      aria-label="Filter by price range"
                    >
                      <SelectValue placeholder="Price Range" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="all">All Prices</SelectItem>
                      <SelectItem value="under200">Under $200</SelectItem>
                      <SelectItem value="200-400">$200 – $400</SelectItem>
                      <SelectItem value="400+">$400+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Stock Status
                  </label>
                  <Select
                    value={filters.stockStatus}
                    onValueChange={(v) => handleChange("stockStatus", v)}
                  >
                    <SelectTrigger
                      className="w-full bg-background border-border"
                      aria-label="Filter by stock status"
                    >
                      <SelectValue placeholder="Stock Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="in-stock">In Stock</SelectItem>
                      <SelectItem value="low-stock">Low Stock</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action buttons — never scrolls */}
              <div className="flex gap-3 px-6 pt-4 pb-6 shrink-0 border-t border-border">
                <Button variant="outline" className="flex-1" onClick={onReset}>
                  Reset
                </Button>
                <Button className="flex-1" onClick={() => setMobileOpen(false)}>
                  Apply
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </>
  );
}
