"use client";

import { useState, useCallback } from "react";
import { Search, ScanLine, Tag } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { lookupIdentifierByImei } from "@/lib/supabase/queries/inventory";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { formatPrice } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { BarcodeLabelDialog } from "@/components/imei-lookup/BarcodeLabelDialog";
import type { IdentifierFullLookup } from "@/types/inventory-identifiers";

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

export default function ImeiLookup() {
  const { companyId } = useCompany();

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<IdentifierFullLookup | null>(null);
  const [searched, setSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !companyId) return;

    setIsLoading(true);
    setResult(null);
    setSearched(true);

    try {
      const data = await lookupIdentifierByImei(companyId, trimmed);
      setResult(data);
      if (!data) {
        toast.error(TOAST_MESSAGES.IMEI_NOT_FOUND);
      }
    } catch {
      toast.error(TOAST_MESSAGES.IMEI_LOOKUP_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [query, companyId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch],
  );

  const item = result?.item;
  const colorLabel = result?.color?.includes(",") ? "Available Colors" : "Available Color";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 space-y-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <ScanLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">IMEI Lookup</h1>
            <p className="text-sm text-muted-foreground">Search for a device by its IMEI number</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 max-w-xl">
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
      </div>

      {/* Results area */}
      <div className="flex-1 min-h-0">
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
                  <DetailField label="IMEI" value={result.imei} />
                  <DetailField label="Serial Number" value={result.serialNumber} />
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

      {/* Barcode dialog */}
      {result?.imei && (
        <BarcodeLabelDialog open={showBarcode} onOpenChange={setShowBarcode} imei={result.imei} />
      )}
    </div>
  );
}
