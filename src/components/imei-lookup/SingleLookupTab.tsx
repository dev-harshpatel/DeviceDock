"use client";

import { Search, ScanLine, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/EmptyState";
import { formatPrice } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import type { IdentifierFullLookup } from "@/types/inventory-identifiers";

interface SingleLookupTabProps {
  query: string;
  setQuery: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleSearch: () => void;
  isLoading: boolean;
  searched: boolean;
  result: IdentifierFullLookup | null;
  setShowBarcode: (val: boolean) => void;
}

const identifierStatusConfig: Record<string, { label: string; className: string }> = {
  in_stock: { label: "In Stock", className: "bg-success/10 text-success border-success/20" },
  reserved: { label: "Reserved", className: "bg-warning/10 text-warning border-warning/20" },
  sold: { label: "Sold", className: "bg-primary/10 text-primary border-primary/20" },
  returned: {
    label: "Returned",
    className: "bg-accent/10 text-accent-foreground border-accent/20",
  },
  damaged: {
    label: "Damaged",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = identifierStatusConfig[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

interface DetailFieldProps {
  label: string;
  value: string | null | undefined;
}

function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

export function SingleLookupTab({
  query,
  setQuery,
  handleKeyDown,
  handleSearch,
  isLoading,
  searched,
  result,
  setShowBarcode,
}: SingleLookupTabProps) {
  const item = result?.item;
  const colorLabel = result?.color?.includes(",") ? "Available Colors" : "Available Color";

  return (
    <div className="mt-4 flex-1 min-h-0">
      {/* Search bar */}
      <div className="flex gap-2 max-w-xl mb-6">
        <Input
          type="text"
          placeholder="Enter IMEI number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isLoading || !query.trim()} className="gap-2">
          <Search className="h-4 w-4" />
          {isLoading ? "Searching..." : "Search"}
        </Button>
      </div>

      {/* Results area */}
      <div>
        {/* Initial state */}
        {!searched && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
              <ScanLine className="h-8 w-8 text-accent-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Look up a device</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Enter an IMEI number above to look up device details and generate a barcode label.
            </p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Looking up IMEI...</p>
          </div>
        )}

        {/* Not found */}
        {searched && !isLoading && !result && (
          <EmptyState
            title="No device found"
            description="No device matches that IMEI number. Please check the number and try again."
          />
        )}

        {/* Result card */}
        {searched && !isLoading && result && item && (
          <div className="max-w-2xl">
            <div className="rounded-lg border border-border bg-card shadow-soft overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between gap-3 p-4 md:p-6 border-b border-border bg-muted/30">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground truncate">
                    {item.deviceName}
                  </h2>
                  <p className="text-sm text-muted-foreground">{item.brand}</p>
                </div>
                <StatusBadge status={result.status} />
              </div>

              {/* Card body — detail grid */}
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  <DetailField
                    label="IMEI / Serial No."
                    value={result.imei ?? result.serialNumber}
                  />
                  <DetailField
                    label="Status"
                    value={identifierStatusConfig[result.status]?.label ?? result.status}
                  />
                  <DetailField label="Grade" value={item.grade} />
                  <DetailField label="Storage" value={item.storage} />
                  <DetailField label={colorLabel} value={result.color} />
                  <DetailField
                    label="Sold Date"
                    value={
                      result.soldAt ? new Date(result.soldAt).toLocaleDateString("en-CA") : null
                    }
                  />
                  <DetailField
                    label="Price Per Unit"
                    value={item.pricePerUnit != null ? formatPrice(item.pricePerUnit) : null}
                  />
                  <DetailField
                    label="Selling Price"
                    value={item.sellingPrice != null ? formatPrice(item.sellingPrice) : null}
                  />
                </div>
              </div>

              {/* Card footer */}
              {result.imei && (
                <div className="flex justify-end p-4 md:p-6 border-t border-border bg-muted/30">
                  <Button onClick={() => setShowBarcode(true)} className="gap-2">
                    <Tag className="h-4 w-4" />
                    Generate Label
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
