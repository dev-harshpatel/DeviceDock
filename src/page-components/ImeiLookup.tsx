"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { List, Loader2, Printer, ScanLine, Search, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { fetchFilterOptions, lookupIdentifierByImei } from "@/lib/supabase/queries/inventory";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { formatPrice } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { BarcodeLabelDialog } from "@/components/imei-lookup/BarcodeLabelDialog";
import { BulkBarcodeLabelDialog } from "@/components/imei-lookup/BulkBarcodeLabelDialog";
import { ImeiListTab } from "@/components/imei-lookup/ImeiListTab";
import type { IdentifierFullLookup } from "@/types/inventory-identifiers";

interface BulkImeiEntry {
  imei: string;
  deviceName: string | null;
  grade: string | null;
  storage: string | null;
  color: string | null;
  sellingPrice: number | null;
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

export default function ImeiLookup() {
  const { companyId } = useCompany();
  const [activeTab, setActiveTab] = useState<string>("single");
  const [storageOptions, setStorageOptions] = useState<string[]>([]);

  // Fetch storage options once for the "All IMEIs" tab filter
  useEffect(() => {
    if (!companyId) return;
    fetchFilterOptions(companyId)
      .then(({ storageOptions: opts }) => setStorageOptions(opts))
      .catch(() => {});
  }, [companyId]);

  // ── Single Lookup state ──
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<IdentifierFullLookup | null>(null);
  const [searched, setSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);

  // ── Bulk Print state ──
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkEntries, setBulkEntries] = useState<BulkImeiEntry[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [showBulkBarcode, setShowBulkBarcode] = useState(false);

  // ── Single Lookup handlers ──
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

  // ── Bulk Print handlers ──
  const handleAddBulkImeis = useCallback(async () => {
    const raw = bulkInput.trim();
    if (!raw || !companyId) return;

    const parsed = raw
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const existingSet = new Set(bulkEntries.map((e) => e.imei));
    const newImeis: string[] = [];
    let duplicateCount = 0;

    for (const imei of parsed) {
      if (existingSet.has(imei)) {
        duplicateCount++;
      } else {
        existingSet.add(imei);
        newImeis.push(imei);
      }
    }

    if (duplicateCount > 0) {
      toast.error(`${duplicateCount} duplicate IMEI${duplicateCount > 1 ? "s" : ""} skipped.`);
    }

    if (newImeis.length === 0) {
      setBulkInput("");
      return;
    }

    setIsBulkLoading(true);
    setBulkInput("");

    const entries: BulkImeiEntry[] = [];
    for (const imei of newImeis) {
      try {
        const data = await lookupIdentifierByImei(companyId, imei);
        entries.push({
          imei,
          deviceName: data?.item.deviceName ?? null,
          grade: data?.item.grade ?? null,
          storage: data?.item.storage ?? null,
          color: data?.color ?? null,
          sellingPrice: data?.item.sellingPrice ?? null,
        });
      } catch {
        entries.push({
          imei,
          deviceName: null,
          grade: null,
          storage: null,
          color: null,
          sellingPrice: null,
        });
      }
    }

    setBulkEntries((prev) => [...prev, ...entries]);
    setIsBulkLoading(false);
    // Restore focus so the user can immediately scan/type the next IMEI.
    bulkInputRef.current?.focus();
  }, [bulkInput, bulkEntries, companyId]);

  const handleBulkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAddBulkImeis();
      }
    },
    [handleAddBulkImeis],
  );

  const handleRemoveBulkEntry = useCallback((index: number) => {
    setBulkEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearBulk = useCallback(() => {
    setBulkEntries([]);
    setBulkInput("");
  }, []);

  const item = result?.item;
  const colorLabel = result?.color?.includes(",") ? "Available Colors" : "Available Color";

  const bulkCount = bulkEntries.length;
  const hasBulkEntries = bulkCount > 0;
  const bulkDialogEntries = bulkEntries.map((e) => ({
    imei: e.imei,
    deviceName: e.deviceName,
    grade: e.grade,
    storage: e.storage,
    sellingPrice: e.sellingPrice,
  }));

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Header */}
      <div className="shrink-0 space-y-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <ScanLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">IMEI Lookup</h1>
            <p className="text-sm text-muted-foreground">
              Search for a device or print barcode labels in bulk
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <TabsList className="bg-muted/60 shrink-0 w-fit justify-start">
          <TabsTrigger value="single" className="gap-2 flex-1 sm:flex-none">
            <Search className="h-3.5 w-3.5" />
            Single Lookup
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2 flex-1 sm:flex-none">
            <Printer className="h-3.5 w-3.5" />
            Bulk Print
            {hasBulkEntries && (
              <span className="ml-1 min-w-[20px] h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {bulkCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2 flex-1 sm:flex-none">
            <List className="h-3.5 w-3.5" />
            All IMEIs
          </TabsTrigger>
        </TabsList>

        {/* ── Single Lookup Tab ── */}
        <TabsContent value="single" className="mt-4 flex-1 min-h-0">
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
        </TabsContent>

        {/* ── Bulk Print Tab ── */}
        <TabsContent value="bulk" className="mt-4 flex-1 min-h-0">
          <div className="space-y-4">
            {/* Input area */}
            <div className="max-w-2xl space-y-2">
              <p className="text-sm text-muted-foreground">
                Enter or scan IMEI numbers separated by commas, spaces, or new lines.
              </p>
              <div className="flex gap-2">
                <Input
                  ref={bulkInputRef}
                  type="text"
                  placeholder="Enter IMEI numbers..."
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  onKeyDown={handleBulkKeyDown}
                  disabled={isBulkLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddBulkImeis}
                  disabled={!bulkInput.trim() || isBulkLoading}
                  className="gap-2"
                >
                  {isBulkLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add"
                  )}
                </Button>
              </div>
            </div>

            {/* Queued IMEIs list */}
            {hasBulkEntries ? (
              <div className="max-w-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {bulkCount} IMEI{bulkCount !== 1 ? "s" : ""} queued
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearBulk}
                    className="text-xs text-muted-foreground hover:text-destructive gap-1.5 h-8"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear all
                  </Button>
                </div>

                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="max-h-64 overflow-y-auto divide-y divide-border">
                    {bulkEntries.map((entry, index) => {
                      const details = [entry.deviceName, entry.grade, entry.storage, entry.color]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <div
                          key={`${entry.imei}-${index}`}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
                        >
                          <div className="min-w-0 mr-3">
                            <p className="text-sm font-mono text-foreground">{entry.imei}</p>
                            {details && (
                              <p className="text-xs text-muted-foreground truncate">{details}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveBulkEntry(index)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={() => setShowBulkBarcode(true)} className="w-full gap-2">
                  <Printer className="h-4 w-4" />
                  Generate {bulkCount} Label{bulkCount !== 1 ? "s" : ""}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mb-3">
                  <Printer className="h-7 w-7 text-accent-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No IMEIs queued</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Enter IMEI numbers above to queue them for bulk label printing.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
        {/* ── All IMEIs Tab — flex layout so table scrolls and pagination stays pinned (inventory / edit products pattern) ── */}
        <TabsContent
          value="all"
          className="mt-4 flex flex-1 flex-col min-h-0 overflow-hidden outline-none data-[state=inactive]:hidden"
        >
          {companyId && <ImeiListTab companyId={companyId} storageOptions={storageOptions} />}
        </TabsContent>
      </Tabs>

      {/* Single barcode dialog */}
      {result?.imei && (
        <BarcodeLabelDialog
          open={showBarcode}
          onOpenChange={setShowBarcode}
          imei={result.imei}
          deviceName={result.item?.deviceName}
          storage={result.item?.storage}
          grade={result.item?.grade}
          sellingPrice={result.item?.sellingPrice}
        />
      )}

      {/* Bulk barcode dialog */}
      {hasBulkEntries && (
        <BulkBarcodeLabelDialog
          open={showBulkBarcode}
          onOpenChange={setShowBulkBarcode}
          entries={bulkDialogEntries}
        />
      )}
    </div>
  );
}
