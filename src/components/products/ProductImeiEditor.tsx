"use client";

import { Loader2, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useIdentifierMap } from "@/hooks/use-identifier-map";
import type { Grade } from "@/lib/constants/grades";
import { GRADES } from "@/lib/constants/grades";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { lookupIdentifierByImei } from "@/lib/supabase/queries";
import { removeTax } from "@/lib/tax";
import { calculatePricePerUnit } from "@/data/inventory";
import type { IdentifierEditLookup } from "@/types/inventory-identifiers";
import { toastError } from "@/lib/utils/toast-helpers";

interface DeviceDraft {
  color: string;
  grade: Grade;
  hst: string;
  pricePerUnit: string;
  sellingPrice: string;
  storage: string;
}

const STATUS_LABELS: Record<string, string> = {
  damaged: "Damaged",
  in_stock: "In Stock",
  reserved: "Reserved",
  returned: "Returned",
  sold: "Sold",
};

const STATUS_STYLES: Record<string, string> = {
  damaged: "border-destructive/30 bg-destructive/10 text-destructive",
  in_stock: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  reserved: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  returned: "border-sky-500/20 bg-sky-500/10 text-sky-700",
  sold: "border-primary/20 bg-primary/10 text-primary",
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function numberFromInput(value: string, fallback: number): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildDraft(result: IdentifierEditLookup): DeviceDraft {
  const hst = result.item.hst ?? 0;
  // Show the base purchase cost (pre-HST) so the user sees the price they actually paid.
  // If the identifier has a stored per-unit cost use it directly; otherwise derive from the
  // group's HST-inclusive pricePerUnit by reversing the tax.
  const rawCost =
    result.purchasePrice != null
      ? result.purchasePrice
      : removeTax(result.item.pricePerUnit ?? 0, hst);
  // Round to 2 decimal places to avoid floating-point display noise (e.g. 100.00000000000001).
  const baseCost = Math.round(rawCost * 100) / 100;

  return {
    color: result.color ?? "",
    grade: result.item.grade,
    hst: String(hst),
    pricePerUnit: String(baseCost),
    sellingPrice: String(result.item.sellingPrice ?? 0),
    storage: result.item.storage,
  };
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const className = STATUS_STYLES[status] ?? "border-border bg-muted text-muted-foreground";

  return <Badge className={className}>{label}</Badge>;
}

export function ProductImeiEditor() {
  const { companyId } = useCompany();
  const { updateIdentifierUnit, groupedInventory } = useInventory();
  const { lookup: mapLookup } = useIdentifierMap();

  const [imeiInput, setImeiInput] = useState("");
  const [result, setResult] = useState<IdentifierEditLookup | null>(null);
  const [draft, setDraft] = useState<DeviceDraft | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!result) {
      setDraft(null);
      return;
    }

    setDraft(buildDraft(result));
  }, [result]);

  // Find the grouped total quantity across all rows with the same spec.
  const groupQuantity = useMemo(() => {
    if (!result) return null;
    const item = result.item;
    const match = groupedInventory.find(
      (g) =>
        g.brand === item.brand &&
        g.deviceName === item.deviceName &&
        g.grade === item.grade &&
        g.storage === item.storage &&
        (g.hst ?? 0) === (item.hst ?? 0),
    );
    return match?.quantity ?? item.quantity;
  }, [result, groupedInventory]);

  const canEdit = result?.status === "in_stock" || result?.status === "reserved";
  const currentHst = draft ? numberFromInput(draft.hst, result?.item.hst ?? 0) : 0;
  // pricePerUnit in draft holds the BASE cost (pre-HST) — what the user paid per unit.
  const currentPricePerUnit = draft
    ? numberFromInput(
        draft.pricePerUnit,
        result?.purchasePrice ?? removeTax(result?.item.pricePerUnit ?? 0, result?.item.hst ?? 0),
      )
    : 0;
  const currentSellingPrice = draft
    ? numberFromInput(draft.sellingPrice, result?.item.sellingPrice ?? 0)
    : 0;
  // Preview shows the HST-inclusive total cost per unit.
  const previewTotalCost = calculatePricePerUnit(currentPricePerUnit, 1, currentHst);

  // Stored base cost for change detection.
  const storedBaseCost = result
    ? (result.purchasePrice ?? removeTax(result.item.pricePerUnit ?? 0, result.item.hst ?? 0))
    : 0;

  const hasChanges =
    !!result &&
    !!draft &&
    (normalizeText(draft.color) !== normalizeText(result.color) ||
      draft.grade !== result.item.grade ||
      normalizeText(draft.storage) !== result.item.storage ||
      Math.abs(currentHst - (result.item.hst ?? 0)) > 0.0001 ||
      Math.abs(currentPricePerUnit - storedBaseCost) > 0.0001 ||
      Math.abs(currentSellingPrice - result.item.sellingPrice) > 0.0001);

  async function refreshLookup(imei: string) {
    // Try the in-memory map first (instant). Fall back to DB for sold/returned units
    // that aren't cached, so the user can still see the blocked-reason UI.
    const cached = mapLookup(imei);
    if (cached) {
      setResult({ ...cached, soldAt: null });
      return;
    }
    const nextLookup = await lookupIdentifierByImei(companyId, imei);
    setResult(nextLookup);
    if (!nextLookup) {
      toast.error(TOAST_MESSAGES.IMEI_NOT_FOUND);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = imeiInput.trim();
    if (!trimmed) {
      toast.error("Enter an IMEI number to search.");
      return;
    }

    setHasSearched(true);
    // Check map synchronously — skip the loading state entirely if cached.
    const cached = mapLookup(trimmed);
    if (cached) {
      setResult({ ...cached, soldAt: null });
      return;
    }
    setIsSearching(true);
    try {
      await refreshLookup(trimmed);
    } catch (error) {
      setResult(null);
      toastError(error, TOAST_MESSAGES.IMEI_LOOKUP_ERROR);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSave() {
    if (!result || !draft || !hasChanges || !canEdit) return;

    setIsSaving(true);
    try {
      await updateIdentifierUnit({
        lookup: result,
        color: normalizeText(draft.color) || null,
        grade: draft.grade,
        storage: normalizeText(draft.storage),
        // Pass base cost (pre-HST); updateIdentifierUnit derives the HST-inclusive pricePerUnit.
        pricePerUnit: currentPricePerUnit,
        sellingPrice: currentSellingPrice,
        hst: currentHst,
      });

      await refreshLookup(result.imei ?? imeiInput.trim());
      toast.success("Device updated", {
        description:
          "This unit was updated successfully. If grouped fields changed, it was separated into its own matching inventory row.",
      });
    } catch (error) {
      toastError(error, "Failed to update this device. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4 py-3">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Edit by IMEI</CardTitle>
          <CardDescription>
            Search an exact IMEI and update that device only. Grouped fields are split out when
            needed so other units stay unchanged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearch}>
            <div className="flex-1">
              <Label htmlFor="product-imei-search" className="sr-only">
                Search IMEI
              </Label>
              <Input
                id="product-imei-search"
                value={imeiInput}
                onChange={(event) => setImeiInput(event.target.value)}
                placeholder="Enter exact IMEI number"
                autoComplete="off"
                inputMode="numeric"
              />
            </div>
            <Button type="submit" className="gap-2 sm:min-w-[140px]" disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search IMEI
            </Button>
          </form>
        </CardContent>
      </Card>

      {isSearching && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Looking up device details by IMEI...</p>
          </CardContent>
        </Card>
      )}

      {!isSearching && hasSearched && !result && (
        <Card>
          <CardContent className="py-2">
            <EmptyState
              title="IMEI not found"
              description="No individual device matches that IMEI. Check the number and try again."
            />
          </CardContent>
        </Card>
      )}

      {!isSearching && result && draft && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{result.item.deviceName}</CardTitle>
                <CardDescription>
                  Update the fields for this device only. Changes to grade, storage, HST, selling
                  price, or price per unit will separate it from the current group when needed.
                </CardDescription>
              </div>
              <StatusBadge status={result.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  IMEI
                </p>
                <p className="font-mono text-sm text-foreground">{result.imei ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Serial
                </p>
                <p className="font-mono text-sm text-foreground">{result.serialNumber ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current Group Qty
                </p>
                <p className="text-sm text-foreground">{groupQuantity ?? result.item.quantity}</p>
              </div>
            </div>

            {!canEdit && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                This unit is {STATUS_LABELS[result.status] ?? result.status}. Device-only edits are
                disabled for non-stock units to avoid changing live inventory counts incorrectly.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="imei-color">Color</Label>
                <Input
                  id="imei-color"
                  value={draft.color}
                  onChange={(event) =>
                    setDraft((prev) => (prev ? { ...prev, color: event.target.value } : prev))
                  }
                  placeholder="Enter device color"
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imei-grade">Grade</Label>
                <Select
                  value={draft.grade}
                  onValueChange={(value) =>
                    setDraft((prev) => (prev ? { ...prev, grade: value as Grade } : prev))
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger id="imei-grade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imei-storage">Storage</Label>
                <Input
                  id="imei-storage"
                  value={draft.storage}
                  onChange={(event) =>
                    setDraft((prev) => (prev ? { ...prev, storage: event.target.value } : prev))
                  }
                  placeholder="e.g. 128GB"
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imei-hst">HST %</Label>
                <Input
                  id="imei-hst"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.hst}
                  onChange={(event) =>
                    setDraft((prev) => (prev ? { ...prev, hst: event.target.value } : prev))
                  }
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imei-price-per-unit">Purchase Cost / Unit (excl. HST)</Label>
                <Input
                  id="imei-price-per-unit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.pricePerUnit}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, pricePerUnit: event.target.value } : prev,
                    )
                  }
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imei-selling-price">Selling Price</Label>
                <Input
                  id="imei-selling-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.sellingPrice}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, sellingPrice: event.target.value } : prev,
                    )
                  }
                  disabled={!canEdit}
                />
              </div>
            </div>

            {canEdit && (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Total cost per unit incl. HST:{" "}
                <span className="font-medium text-foreground">
                  {Number.isFinite(previewTotalCost) ? previewTotalCost.toFixed(2) : "0.00"}
                </span>
                . This device will stay in its current group only if the grouped fields still match.
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSave}
                disabled={!canEdit || !hasChanges || isSaving}
                className="gap-2"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Device Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
