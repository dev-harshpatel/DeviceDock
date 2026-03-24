"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useInventory } from "@/contexts/InventoryContext";
import { setAdminOffer } from "@/lib/supabase/queries/wishes";
import { formatPrice, formatDateInOntario, cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Search, CheckCircle2, XCircle, Package, Store, Users } from "lucide-react";
import type { InventoryItem } from "@/data/inventory";

interface AdminWishEntry {
  id: string;
  model: string;
  grade: string;
  storage: string;
  qtyWanted: number;
  maxPricePerUnit: number | null;
  status: string;
  offerPricePerUnit?: number | null;
  offerQty?: number | null;
  offerInventoryItemId?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  userEmail?: string;
}

interface AdminWishDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wish: AdminWishEntry | null;
  onUpdated: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Under Review",
  offered: "Approved",
  reserved: "Reserved",
  ordered: "Ordered",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending:
    "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400",
  offered:
    "text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400",
  reserved:
    "text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400",
  rejected:
    "text-red-600 border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 dark:text-red-400",
  cancelled: "text-muted-foreground border-border",
  fulfilled:
    "text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400",
};

export function AdminWishDetailsModal({
  open,
  onOpenChange,
  wish,
  onUpdated,
}: AdminWishDetailsModalProps) {
  const { inventory } = useInventory();

  const [fulfilMode, setFulfilMode] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerQty, setOfferQty] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [fulfilSource, setFulfilSource] = useState<"inventory" | "external">("inventory");
  const [externalSupplier, setExternalSupplier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeInventory = useMemo(
    () =>
      inventory.filter(
        (item) =>
          item.isActive !== false &&
          item.quantity > 0 &&
          (!inventorySearch.trim() ||
            item.deviceName
              .toLowerCase()
              .includes(inventorySearch.toLowerCase()) ||
            item.brand.toLowerCase().includes(inventorySearch.toLowerCase()) ||
            item.storage.toLowerCase().includes(inventorySearch.toLowerCase()))
      ),
    [inventory, inventorySearch]
  );

  const handleOpenFulfil = () => {
    setOfferPrice(wish?.offerPricePerUnit?.toString() ?? "");
    setOfferQty(wish?.offerQty?.toString() ?? wish?.qtyWanted.toString() ?? "1");
    setAdminNotes(wish?.adminNotes ?? "");
    setSelectedItem(null);
    setInventorySearch("");
    setFulfilSource("inventory");
    setExternalSupplier("");
    setFulfilMode(true);
  };

  const handleFulfil = async () => {
    if (!wish) return;

    const price = Number(offerPrice);
    const qty = Number(offerQty);

    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Please enter a valid offer price.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Please enter a valid offer quantity.");
      return;
    }

    // Build combined admin notes (prepend external supplier if set)
    let combinedNotes = adminNotes.trim();
    if (fulfilSource === "external" && externalSupplier.trim()) {
      const supplierLine = `Source: ${externalSupplier.trim()}`;
      combinedNotes = combinedNotes
        ? `${supplierLine}\n${combinedNotes}`
        : supplierLine;
    }

    setIsSubmitting(true);
    try {
      await setAdminOffer(wish.id, {
        status: "offered",
        offerPricePerUnit: price,
        offerQty: qty,
        offerInventoryItemId: fulfilSource === "inventory" ? (selectedItem?.id ?? null) : null,
        adminNotes: combinedNotes || null,
      });
      toast.success("Pre-order approved — user has been notified.");
      setFulfilMode(false);
      onUpdated();
      onOpenChange(false);
    } catch {
      toast.error("Failed to fulfil request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!wish) return;
    setIsSubmitting(true);
    try {
      await setAdminOffer(wish.id, {
        status: "rejected",
        adminNotes: adminNotes.trim() || null,
      });
      toast.success("Pre-order request rejected.");
      onUpdated();
      onOpenChange(false);
    } catch {
      toast.error("Failed to reject request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFulfilMode(false);
    setOfferPrice("");
    setOfferQty("");
    setAdminNotes("");
    setSelectedItem(null);
    setInventorySearch("");
    setFulfilSource("inventory");
    setExternalSupplier("");
    onOpenChange(false);
  };

  if (!wish) return null;

  const isPending = wish.status === "pending";
  const isOffered = wish.status === "offered";
  const isClosed =
    wish.status === "rejected" ||
    wish.status === "cancelled" ||
    wish.status === "fulfilled";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pre-Order Request</DialogTitle>
        </DialogHeader>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge
            variant="outline"
            className={cn("text-xs", STATUS_COLORS[wish.status] ?? "")}
          >
            {STATUS_LABELS[wish.status] ?? wish.status}
          </Badge>
        </div>

        <Separator />

        {/* Request Details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
              Customer
            </p>
            <p className="font-medium">
              {wish.userEmail ?? wish.id.slice(0, 8) + "…"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
              Submitted
            </p>
            <p>{formatDateInOntario(wish.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
              Device
            </p>
            <p className="font-medium">{wish.model}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
              Grade
            </p>
            <p>{wish.grade}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
              Storage
            </p>
            <p>{wish.storage}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
              Qty Requested
            </p>
            <p>{wish.qtyWanted}</p>
          </div>
          {wish.maxPricePerUnit != null && (
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                Customer Budget
              </p>
              <p className="font-medium">{formatPrice(wish.maxPricePerUnit)} / unit</p>
            </div>
          )}
        </div>

        {/* Existing offer details (if already approved) */}
        {isOffered && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Approved Offer
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm pl-6">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                    Price / Unit
                  </p>
                  <p className="font-semibold">
                    {formatPrice(wish.offerPricePerUnit ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                    Qty Approved
                  </p>
                  <p>{wish.offerQty}</p>
                </div>
              </div>
              {wish.adminNotes && (
                <div className="text-xs text-muted-foreground pl-6 space-y-0.5">
                  {wish.adminNotes.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Fulfil Form */}
        {fulfilMode && (
          <>
            <Separator />
            <div className="space-y-4">
              <p className="text-sm font-medium">Fulfil Request</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Offer Price / Unit{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      placeholder="0.00"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Qty to Approve <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={offerQty}
                    onChange={(e) => setOfferQty(e.target.value)}
                  />
                </div>
              </div>

              {/* Fulfilment Source Toggle */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fulfilment Source</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFulfilSource("inventory");
                      setExternalSupplier("");
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                      fulfilSource === "inventory"
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    <Package className="h-4 w-4 shrink-0" />
                    From Inventory
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFulfilSource("external");
                      setSelectedItem(null);
                      setInventorySearch("");
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                      fulfilSource === "external"
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    External / Offline
                  </button>
                </div>
              </div>

              {/* Inventory Item Selector — shown when source is inventory */}
              {fulfilSource === "inventory" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Link Inventory Item{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  {selectedItem ? (
                    <div className="flex items-center justify-between rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">
                          {selectedItem.deviceName}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {selectedItem.grade} · {selectedItem.storage} ·{" "}
                          {selectedItem.quantity} in stock
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground ml-2"
                        onClick={() => setSelectedItem(null)}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search inventory…"
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-md border border-input">
                        {activeInventory.length === 0 ? (
                          <p className="py-3 text-center text-sm text-muted-foreground">
                            No items found
                          </p>
                        ) : (
                          activeInventory.slice(0, 20).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground border-b border-border last:border-0"
                              onClick={() => setSelectedItem(item)}
                            >
                              <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span>
                                <span className="font-medium">
                                  {item.deviceName}
                                </span>
                                <span className="text-muted-foreground ml-2">
                                  {item.grade} · {item.storage} ·{" "}
                                  {formatPrice(item.sellingPrice ?? item.pricePerUnit)}{" "}
                                  · {item.quantity} in stock
                                </span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* External supplier field — shown when source is external */}
              {fulfilSource === "external" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Supplier / Contact{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. John's Wholesale, eBay lot, offline contact…"
                      value={externalSupplier}
                      onChange={(e) => setExternalSupplier(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Admin Notes (optional)
                </label>
                <Textarea
                  placeholder="Any notes for the customer…"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {!isClosed && !fulfilMode && (
            <>
              {(isPending || isOffered) && (
                <Button
                  onClick={handleOpenFulfil}
                  className="flex-1 gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isOffered ? "Update Offer" : "Fulfil"}
                </Button>
              )}
              {isPending && (
                <Button
                  variant="outline"
                  className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
                  onClick={handleReject}
                  disabled={isSubmitting}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              )}
            </>
          )}

          {fulfilMode && (
            <>
              <Button
                onClick={handleFulfil}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm Fulfil
              </Button>
              <Button
                variant="outline"
                onClick={() => setFulfilMode(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </>
          )}

          {(isClosed || (!isPending && !isOffered && !fulfilMode)) && (
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
