"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useIdentifierMap } from "@/hooks/use-identifier-map";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { lookupIdentifierByImei } from "@/lib/supabase/queries";
import { removeTax } from "@/lib/tax";
import type { IdentifierFullLookup } from "@/types/inventory-identifiers";
import { toastError } from "@/lib/utils/toast-helpers";

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

const DELETION_BLOCKED_REASON: Record<string, string> = {
  sold: "This unit has been sold and is linked to an order. Sold units cannot be deleted to preserve order history.",
  reserved: "This unit is reserved for a pending order. Cancel the reservation before deleting.",
  returned:
    "This unit has order history (it was returned). Delete is blocked to preserve order records.",
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const className = STATUS_STYLES[status] ?? "border-border bg-muted text-muted-foreground";
  return <Badge className={className}>{label}</Badge>;
}

export function ProductImeiDeleter() {
  const { companyId } = useCompany();
  const { deleteIdentifierUnit, groupedInventory } = useInventory();
  const { lookup: mapLookup } = useIdentifierMap();

  const [imeiInput, setImeiInput] = useState("");
  const [result, setResult] = useState<IdentifierFullLookup | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  const canDelete = result?.status === "in_stock" || result?.status === "damaged";
  const blockReason =
    result && !canDelete
      ? (DELETION_BLOCKED_REASON[result.status] ??
        `Units with status "${result.status}" cannot be deleted.`)
      : null;

  // Total units in the same-spec group (for the impact preview).
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

  // Base purchase cost that this unit contributed (pre-HST).
  const unitBaseCost = result
    ? (result.purchasePrice ??
      (result.item.quantity > 0
        ? (result.item.purchasePrice ?? 0) / result.item.quantity
        : removeTax(result.item.pricePerUnit ?? 0, result.item.hst ?? 0)))
    : 0;

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = imeiInput.trim();
    if (!trimmed) {
      toast.error("Enter an IMEI number to search.");
      return;
    }
    setHasSearched(true);
    setConfirmStep(false);
    setResult(null);

    // Check the in-memory map first — instant for in_stock/reserved/damaged units.
    const cached = mapLookup(trimmed);
    if (cached) {
      setResult({ ...cached, soldAt: null });
      return;
    }

    // Fall back to DB for sold/returned units (blocked anyway, but show the reason).
    setIsSearching(true);
    try {
      const lookup = await lookupIdentifierByImei(companyId, trimmed);
      setResult(lookup);
      if (!lookup) toast.error(TOAST_MESSAGES.IMEI_NOT_FOUND);
    } catch (error) {
      toastError(error, TOAST_MESSAGES.IMEI_LOOKUP_ERROR);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleDelete() {
    if (!result || !canDelete) return;
    setIsDeleting(true);
    try {
      await deleteIdentifierUnit({ lookup: result });
      toast.success("Device deleted", {
        description: `${result.item.deviceName} (${result.imei ?? result.serialNumber ?? "—"}) has been removed from inventory.`,
      });
      setResult(null);
      setImeiInput("");
      setHasSearched(false);
      setConfirmStep(false);
    } catch (error) {
      toastError(error, "Failed to delete this device. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4 py-3">
      {/* Search */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Delete by IMEI</CardTitle>
          <CardDescription>
            Search an exact IMEI and permanently remove that unit. The parent row&apos;s quantity
            and purchase cost are recalculated automatically. Only in-stock and damaged units can be
            deleted — sold and reserved units are locked to preserve order records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearch}>
            <div className="flex-1">
              <Label htmlFor="delete-imei-search" className="sr-only">
                Search IMEI
              </Label>
              <Input
                id="delete-imei-search"
                value={imeiInput}
                onChange={(e) => setImeiInput(e.target.value)}
                placeholder="Enter exact IMEI number"
                autoComplete="off"
                inputMode="numeric"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="gap-2 sm:min-w-[140px]"
              disabled={isSearching}
            >
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

      {/* Searching */}
      {isSearching && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Looking up device by IMEI...</p>
          </CardContent>
        </Card>
      )}

      {/* Not found */}
      {!isSearching && hasSearched && !result && (
        <Card>
          <CardContent className="py-2">
            <EmptyState
              title="IMEI not found"
              description="No device matches that IMEI. Check the number and try again."
            />
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {!isSearching && result && (
        <Card className={canDelete ? "border-destructive/25" : ""}>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{result.item.deviceName}</CardTitle>
                <CardDescription>
                  {result.item.brand} · Grade {result.item.grade} · {result.item.storage}
                </CardDescription>
              </div>
              <StatusBadge status={result.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Identifier details */}
            <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-4">
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
                  Color
                </p>
                <p className="text-sm text-foreground">{result.color ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Group Qty
                </p>
                <p className="text-sm text-foreground">{groupQuantity ?? result.item.quantity}</p>
              </div>
            </div>

            {/* Blocked reason */}
            {blockReason && (
              <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{blockReason}</p>
              </div>
            )}

            {/* Deletion impact preview */}
            {canDelete && (
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What will change
                </p>
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Purchase cost removed</p>
                    <p className="font-semibold text-foreground">
                      ${unitBaseCost.toFixed(2)} excl. HST
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Group qty</p>
                    <p className="font-semibold text-foreground">
                      {groupQuantity ?? result.item.quantity}
                      {" → "}
                      {Math.max(0, (groupQuantity ?? result.item.quantity) - 1)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">DB row qty</p>
                    <p className="font-semibold text-foreground">
                      {result.item.quantity}
                      {" → "}
                      {Math.max(0, result.item.quantity - 1)}
                      {result.item.quantity === 1 && (
                        <span className="ml-1.5 text-xs font-normal text-destructive">
                          (row deleted)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {canDelete && (
              <div className="flex items-center justify-end gap-3 pt-1">
                {confirmStep ? (
                  <>
                    <p className="mr-auto text-sm font-medium text-destructive">
                      Permanently delete this unit?
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmStep(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="gap-2"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Yes, Delete
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmStep(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete This Device
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
