"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Filter, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { GRADES, GRADE_LABELS } from "@/lib/constants/grades";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import {
  defaultIdentifierFilters,
  fetchPaginatedIdentifiers,
  type IdentifierFilters,
  type IdentifierListItem,
} from "@/lib/supabase/queries/inventory";
import { queryKeys } from "@/lib/query-keys";
import { useDebounce } from "@/hooks/use-debounce";
import { usePaginatedReactQuery } from "@/hooks/use-paginated-react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/common/PaginationControls";

const IMEI_LIST_PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, string> = {
  in_stock: "In Stock",
  reserved: "Reserved",
  sold: "Sold",
  returned: "Returned",
  damaged: "Damaged",
};

const STATUS_CONFIG: Record<string, string> = {
  in_stock: "bg-success/10 text-success border-success/20",
  reserved: "bg-warning/10 text-warning border-warning/20",
  sold: "bg-primary/10 text-primary border-primary/20",
  returned: "bg-accent/10 text-accent-foreground border-accent/20",
  damaged: "bg-destructive/10 text-destructive border-destructive/20",
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const cls = STATUS_CONFIG[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
        cls,
      )}
    >
      {label}
    </span>
  );
}

interface CopyIdentifierValueProps {
  ariaLabel: string;
  tooltipLabel: string;
  value: string | null;
}

function CopyIdentifierValue({ ariaLabel, tooltipLabel, value }: CopyIdentifierValueProps) {
  const trimmed = value?.trim() ?? "";

  const handleCopy = async () => {
    if (!trimmed) return;
    try {
      await navigator.clipboard.writeText(trimmed);
      toast.success("Copied to clipboard");
    } catch {
      toast.error(TOAST_MESSAGES.ERROR_TRY_AGAIN);
    }
  };

  if (!trimmed) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="font-mono text-xs text-foreground truncate">{trimmed}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            aria-label={ariaLabel}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}

interface ImeiListFilterBarProps {
  filters: IdentifierFilters;
  storageOptions: string[];
  onFiltersChange: (f: IdentifierFilters) => void;
  onReset: () => void;
}

function ImeiListFilterBar({
  filters,
  storageOptions,
  onFiltersChange,
  onReset,
}: ImeiListFilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const set = (key: keyof IdentifierFilters, value: string) =>
    onFiltersChange({ ...filters, [key]: value });

  const hasActive =
    filters.search.trim() ||
    filters.grade !== "all" ||
    filters.storage !== "all" ||
    filters.status !== "all";

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search device name..."
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>

        <Select value={filters.grade} onValueChange={(v) => set("grade", v)}>
          <SelectTrigger
            className="w-[160px] bg-background border-border focus:ring-1 focus:ring-border focus:ring-offset-0"
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

        <Select value={filters.storage} onValueChange={(v) => set("storage", v)}>
          <SelectTrigger
            className="w-[130px] bg-background border-border focus:ring-1 focus:ring-border focus:ring-offset-0"
            aria-label="Filter by storage"
          >
            <SelectValue placeholder="Storage" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-[280px] overflow-y-auto">
            <SelectItem value="all">All Storage</SelectItem>
            {storageOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger
            className="w-[130px] bg-background border-border focus:ring-1 focus:ring-border focus:ring-offset-0"
            aria-label="Filter by status"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={!hasActive}
          className="border-border ml-auto"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search device name..."
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => setMobileOpen(true)}>
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile sheet */}
      {mobileOpen &&
        createPortal(
          <div className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-sm">
            <div className="fixed inset-x-0 bottom-0 z-[201] bg-card border-t border-border rounded-t-xl flex flex-col max-h-[85vh] animate-fade-in">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                <h3 className="text-lg font-semibold">Filters</h3>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 px-6 space-y-4 pb-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Grade</label>
                  <Select value={filters.grade} onValueChange={(v) => set("grade", v)}>
                    <SelectTrigger className="w-full bg-background border-border focus:ring-1 focus:ring-border focus:ring-offset-0">
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
                  <label className="text-sm font-medium mb-2 block">Storage</label>
                  <Select value={filters.storage} onValueChange={(v) => set("storage", v)}>
                    <SelectTrigger className="w-full bg-background border-border focus:ring-1 focus:ring-border focus:ring-offset-0">
                      <SelectValue placeholder="Storage" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-[280px] overflow-y-auto">
                      <SelectItem value="all">All Storage</SelectItem>
                      {storageOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={filters.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger className="w-full bg-background border-border focus:ring-1 focus:ring-border focus:ring-offset-0">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="all">All Status</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
          document.body,
        )}
    </>
  );
}

interface ImeiListTabProps {
  companyId: string;
  storageOptions: string[];
}

export function ImeiListTab({ companyId, storageOptions }: ImeiListTabProps) {
  const [filters, setFilters] = useState<IdentifierFilters>(defaultIdentifierFilters);
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearch = useDebounce(filters.search, 300);
  const filtersForQuery = useMemo(
    (): IdentifierFilters => ({
      search: debouncedSearch,
      grade: filters.grade,
      storage: filters.storage,
      status: filters.status,
    }),
    [debouncedSearch, filters.grade, filters.storage, filters.status],
  );

  const filtersKey = JSON.stringify(filtersForQuery);

  const queryKey = useMemo(
    () => queryKeys.identifiersPage(companyId, currentPage, filtersKey),
    [companyId, currentPage, filtersKey],
  );

  const fetchPage = useCallback(
    async (range: { from: number; to: number }) => {
      try {
        return await fetchPaginatedIdentifiers(companyId, filtersForQuery, range);
      } catch {
        toast.error(TOAST_MESSAGES.ERROR_TRY_AGAIN);
        throw new Error("fetchPaginatedIdentifiers failed");
      }
    },
    [companyId, filtersForQuery],
  );

  const {
    data: items,
    totalCount,
    totalPages,
    isLoading,
    isFetching,
    rangeText,
  } = usePaginatedReactQuery<IdentifierListItem>({
    queryKey,
    fetchFn: fetchPage,
    currentPage,
    setCurrentPage,
    pageSize: IMEI_LIST_PAGE_SIZE,
    enabled: Boolean(companyId),
    filtersKey,
    refetchOnWindowFocus: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
  });

  const handleFiltersChange = useCallback((f: IdentifierFilters) => {
    setFilters(f);
  }, []);

  const handleReset = useCallback(() => {
    setFilters(defaultIdentifierFilters);
  }, []);

  const shouldShowInitialLoad = (isLoading || isFetching) && items.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 -mx-4 lg:-mx-6 px-4 lg:px-6">
      <div className="shrink-0 space-y-4 pb-3">
        <ImeiListFilterBar
          filters={filters}
          storageOptions={storageOptions}
          onFiltersChange={handleFiltersChange}
          onReset={handleReset}
        />
      </div>

      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        {shouldShowInitialLoad && (
          <div className="flex flex-1 min-h-[12rem] items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        )}

        {!shouldShowInitialLoad && items.length === 0 && (
          <div className="flex flex-1 min-h-[12rem] flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-sm text-muted-foreground">
              No IMEIs found matching the current filters.
            </p>
          </div>
        )}

        {!shouldShowInitialLoad && items.length > 0 && (
          <>
            {/* Desktop: same scroll pattern as InventoryTable — flex column + inner overflow-y-auto */}
            <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        IMEI
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Serial #
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Device
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Grade
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Storage
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Color
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Damage Note
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => (
                      <tr
                        key={item.identifierId}
                        className="hover:bg-table-hover transition-colors"
                      >
                        <td className="px-4 py-3">
                          <CopyIdentifierValue
                            ariaLabel="Copy IMEI"
                            tooltipLabel="Copy IMEI"
                            value={item.imei}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <CopyIdentifierValue
                            ariaLabel="Copy Sr. No."
                            tooltipLabel="Copy Sr. No."
                            value={item.serialNumber}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{item.deviceName}</div>
                          <div className="text-xs text-muted-foreground">{item.brand}</div>
                        </td>
                        <td className="px-4 py-3 text-foreground">{item.grade}</td>
                        <td className="px-4 py-3 text-foreground">{item.storage}</td>
                        <td className="px-4 py-3 text-foreground">
                          {item.color ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          {item.damageNote ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 cursor-default max-w-full">
                                  <span className="truncate max-w-[140px]">{item.damageNote}</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-[280px] text-xs whitespace-pre-wrap"
                              >
                                {item.damageNote}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:hidden flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden space-y-3 pb-2">
              {items.map((item) => (
                <div
                  key={item.identifierId}
                  className="p-4 bg-card rounded-lg border border-border space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{item.deviceName}</p>
                      <p className="text-xs text-muted-foreground">{item.brand}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">IMEI</p>
                      <CopyIdentifierValue
                        ariaLabel="Copy IMEI"
                        tooltipLabel="Copy IMEI"
                        value={item.imei}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Serial #</p>
                      <CopyIdentifierValue
                        ariaLabel="Copy Sr. No."
                        tooltipLabel="Copy Sr. No."
                        value={item.serialNumber}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Grade</p>
                      <p className="text-foreground">{item.grade}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Storage</p>
                      <p className="text-foreground">{item.storage}</p>
                    </div>
                    {item.color && (
                      <div>
                        <p className="text-xs text-muted-foreground">Color</p>
                        <p className="text-foreground">{item.color}</p>
                      </div>
                    )}
                  </div>
                  {item.damageNote && (
                    <div className="mt-1 pt-2 border-t border-border/60">
                      <p className="text-xs text-muted-foreground mb-1">Damage Note</p>
                      <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5 border border-destructive/20">
                        {item.damageNote}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {totalCount > 0 && (
        <div className="flex-shrink-0 bg-background border-t border-border -mx-4 lg:-mx-6 px-4 lg:px-6 pt-1.5 pb-3 lg:pb-4 [&_button]:h-8 [&_button]:min-w-8 [&_button]:text-xs [&_button]:px-2 lg:[&_button]:h-9 lg:[&_button]:min-w-9 lg:[&_button]:text-sm lg:[&_button]:px-3">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            rangeText={rangeText}
          />
        </div>
      )}
    </div>
  );
}
