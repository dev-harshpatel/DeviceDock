"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, ShoppingBag, Trash2 } from "lucide-react";
import { removeTax } from "@/lib/tax";
import { useInventory } from "@/contexts/InventoryContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import { toastError } from "@/lib/utils/toast-helpers";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { cn } from "@/lib/utils";
import { Order } from "@/types/order";
import { supabase } from "@/lib/supabase/client";
import { OrderItemCard } from "@/components/modals/OrderItemCard";
import { OrderInfoSection } from "@/components/modals/OrderInfoSection";
import { OrderTotalSection } from "@/components/modals/OrderTotalSection";
import { ProfitRowCard, type ProfitRow } from "@/components/modals/ProfitRowCard";

interface OrderDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

const getCostPerUnitWithoutHst = (
  purchasePrice: number | null | undefined,
  quantity: number,
  pricePerUnit: number,
  hst: number | null | undefined,
): number | null => {
  if (quantity <= 0) return null;
  if (purchasePrice != null) return purchasePrice / quantity;
  if (hst != null && hst > 0) return removeTax(pricePerUnit, hst);
  return pricePerUnit;
};

export const OrderDetailsModal = ({ open, onOpenChange, order }: OrderDetailsModalProps) => {
  const { startNavigation } = useNavigation();
  const { downloadInvoicePDF, deleteOrder, refreshOrders } = useOrders();
  const { inventory, refreshInventory } = useInventory();
  const { canWrite: isAdmin, slug: companySlug } = useCompany();
  const router = useRouter();

  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeleteInFlightRef = useRef(false);
  const [colorAssignments, setColorAssignments] = useState<
    Record<string, { color: string; quantity: number }[]>
  >({});
  const [fetchedIdentifierLabels, setFetchedIdentifierLabels] = useState<Record<string, string>>(
    {},
  );
  const [fetchedIdentifierColors, setFetchedIdentifierColors] = useState<Record<string, string>>(
    {},
  );
  const [fetchedIdentifierDamageNotes, setFetchedIdentifierDamageNotes] = useState<
    Record<string, string>
  >({});

  const orderId = order?.id;
  const orderUserId = order?.userId;
  const orderIsManualSale = order?.isManualSale;
  const orderItemsJsonKey = order?.items != null ? JSON.stringify(order.items) : "";

  useEffect(() => {
    if (!open || !order) {
      setFetchedIdentifierLabels({});
      setFetchedIdentifierColors({});
      setFetchedIdentifierDamageNotes({});
      return;
    }
    const items = Array.isArray(order.items) ? order.items : [];
    const allIdentifierIds = items
      .filter((oi) => oi.inventoryIdentifierId)
      .map((oi) => oi.inventoryIdentifierId as string);

    if (allIdentifierIds.length === 0) return;

    (supabase as any)
      .from("inventory_identifiers")
      .select("id, imei, serial_number, color, damage_note")
      .in("id", allIdentifierIds)
      .then(
        ({
          data,
        }: {
          data:
            | {
                id: string;
                imei: string | null;
                serial_number: string | null;
                color: string | null;
                damage_note: string | null;
              }[]
            | null;
        }) => {
          if (!data) return;
          const labelMap: Record<string, string> = {};
          const colorMap: Record<string, string> = {};
          const damageNoteMap: Record<string, string> = {};
          for (const row of data) {
            labelMap[row.id] = row.imei ?? row.serial_number ?? row.id;
            if (row.color) colorMap[row.id] = row.color;
            if (row.damage_note) damageNoteMap[row.id] = row.damage_note;
          }
          setFetchedIdentifierLabels(labelMap);
          setFetchedIdentifierColors(colorMap);
          setFetchedIdentifierDamageNotes(damageNoteMap);
        },
      );
  }, [open, orderId, orderItemsJsonKey]);

  useEffect(() => {
    if (!open || !orderUserId || orderIsManualSale) return;
    fetch("/api/users/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [orderUserId] }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setCustomerEmail(data.emails[orderUserId] || null);
      })
      .catch(() => {});
  }, [open, orderIsManualSale, orderUserId]);

  useEffect(() => {
    if (!open || !orderId || !isAdmin) return;
    fetch(`/api/admin/order-color-assignments?order_id=${encodeURIComponent(orderId)}`)
      .then((r) => (r.ok ? r.json() : { assignments: {} }))
      .then((data) => setColorAssignments(data.assignments ?? {}))
      .catch(() => setColorAssignments({}));
  }, [open, isAdmin, orderId]);

  const invoiceRoute = order ? `/${companySlug}/orders/${order.id}/invoice` : "";

  const handlePrefetchInvoice = useCallback(() => {
    if (!order || !router || !invoiceRoute) return;
    router.prefetch(invoiceRoute);
  }, [invoiceRoute, order, router]);

  if (!order) return null;

  const orderItems = Array.isArray(order.items) ? order.items : [];

  // ── Profit calculation ────────────────────────────────────────────────────
  const profitRows: ProfitRow[] = orderItems
    .filter((oi) => oi?.item)
    .map((oi) => {
      const liveItem = inventory.find((inv) => inv.id === oi.item.id);
      const purchasePriceSnap = oi.item.purchasePrice ?? liveItem?.purchasePrice ?? null;
      const hstSnap = oi.item.hst ?? liveItem?.hst ?? null;
      const pricePerUnitSnap = oi.item.pricePerUnit || (liveItem?.pricePerUnit ?? 0);
      const qty = oi.quantity || 0;
      const sellingPerUnit = oi.item.sellingPrice ?? oi.item.pricePerUnit ?? 0;
      const batchQty = oi.item.quantity ?? 1;
      const rawCostPerUnit = getCostPerUnitWithoutHst(
        purchasePriceSnap,
        batchQty,
        pricePerUnitSnap,
        hstSnap,
      );
      const costPerUnit = rawCostPerUnit ?? pricePerUnitSnap;
      const revenue = sellingPerUnit * qty;
      const cost = costPerUnit * qty;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : null;
      return {
        itemName: oi.item.deviceName || "Unknown Device",
        storage: oi.item.storage || "N/A",
        grade: oi.item.grade || "N/A",
        quantity: qty,
        sellingPerUnit,
        costPerUnit,
        revenue,
        cost,
        profit,
        margin,
      };
    });

  const totalRevenue = profitRows.reduce((s, r) => s + r.revenue, 0);
  const totalCost = profitRows.reduce((s, r) => s + r.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDeleteOrder = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== "confirm") return;
    if (isDeleteInFlightRef.current) return;
    isDeleteInFlightRef.current = true;
    setIsDeleting(true);
    try {
      await deleteOrder(order.id);
      await refreshInventory();
      toast.success("Order deleted and stock restored successfully.");
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
      onOpenChange(false);
    } catch (error: unknown) {
      toastError(error, "Failed to delete order. Please try again.");
    } finally {
      setIsDeleting(false);
      isDeleteInFlightRef.current = false;
    }
  };

  // ── Permission flags ──────────────────────────────────────────────────────
  const canDeleteOrder = isAdmin;
  const canEditManualSale =
    isAdmin && order.isManualSale === true && order.invoiceConfirmed !== true;
  const hasInvoice = !!order.invoiceNumber;
  const canDownloadInvoice = hasInvoice && isAdmin;
  const canCreateEditInvoice = isAdmin;

  const handleDownloadInvoice = async () => {
    setIsDownloading(true);
    try {
      await downloadInvoicePDF(order.id);
      toast.success(TOAST_MESSAGES.INVOICE_DOWNLOADED);
    } catch {
      toast.error(TOAST_MESSAGES.INVOICE_DOWNLOAD_FAILED);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCreateEditInvoice = () => {
    startNavigation();
    router.push(invoiceRoute);
    onOpenChange(false);
  };

  const handleEditManualSale = () => {
    if (!companySlug) return;
    startNavigation();
    onOpenChange(false);
    router.push(`/${companySlug}/orders/manual-sale/edit/${order.id}`);
  };

  // ── Shared JSX pieces ─────────────────────────────────────────────────────
  const manualSaleBanner = order.isManualSale && (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-50 border border-orange-200 dark:bg-orange-950 dark:border-orange-800 text-sm text-orange-700 dark:text-orange-400">
      <ShoppingBag className="h-4 w-4 flex-shrink-0" />
      <span>This is a manually recorded sale — it was created directly by an admin.</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader>
          <div className="flex items-start pr-8">
            <div>
              <DialogTitle>Order #{order.id.slice(-8).toUpperCase()}</DialogTitle>
              <DialogDescription>Order details and summary</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isAdmin ? (
          <Tabs defaultValue="order" className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="order">Order</TabsTrigger>
              <TabsTrigger value="profit">Profit</TabsTrigger>
            </TabsList>

            {/* ── Order tab ── */}
            <TabsContent
              value="order"
              className="flex-1 min-h-0 mt-3 overflow-y-auto overflow-x-hidden pr-1 data-[state=active]:flex data-[state=active]:flex-col"
            >
              <div className="space-y-6 pb-3">
                {manualSaleBanner}
                <OrderInfoSection order={order} customerEmail={customerEmail} />

                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Order Items</h3>
                  {orderItems.length > 0 ? (
                    <div className="space-y-3">
                      {orderItems.map((oi, i) =>
                        oi?.item ? (
                          <OrderItemCard
                            key={i}
                            orderItem={oi}
                            colorAssignments={colorAssignments}
                            fetchedIdentifierLabels={fetchedIdentifierLabels}
                            fetchedIdentifierColors={fetchedIdentifierColors}
                            fetchedIdentifierDamageNotes={fetchedIdentifierDamageNotes}
                          />
                        ) : null,
                      )}
                    </div>
                  ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      No items in this order
                    </p>
                  )}
                </div>

                <OrderTotalSection order={order} />
              </div>
            </TabsContent>

            {/* ── Profit tab ── */}
            <TabsContent
              value="profit"
              className="flex-1 min-h-0 mt-3 overflow-y-auto overflow-x-hidden pr-1 data-[state=active]:flex data-[state=active]:flex-col"
            >
              <div className="space-y-4 pb-3">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="font-semibold text-foreground">Profit Summary</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated from item-level selling price and cost per unit (purchase price
                    without HST when available).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <div className="rounded-md border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="text-base sm:text-lg font-semibold text-foreground mt-1">
                        {formatPrice(totalRevenue)}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Cost</p>
                      <p className="text-base sm:text-lg font-semibold text-foreground mt-1">
                        {formatPrice(totalCost)}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Profit</p>
                      <p
                        className={cn(
                          "text-base sm:text-lg font-semibold mt-1",
                          totalProfit >= 0 ? "text-emerald-600" : "text-destructive",
                        )}
                      >
                        {formatPrice(totalProfit)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Margin: {totalMargin.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Item Profit</h3>
                  {profitRows.length > 0 ? (
                    profitRows.map((row, i) => (
                      <ProfitRowCard key={`${row.itemName}-${i}`} row={row} />
                    ))
                  ) : (
                    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground text-center">
                      No items available for profit calculation.
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pb-3">
            {manualSaleBanner}
            <OrderInfoSection order={order} customerEmail={customerEmail} />

            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Order Items</h3>
              {orderItems.length > 0 ? (
                <div className="space-y-3">
                  {orderItems.map((oi, i) =>
                    oi?.item ? <OrderItemCard key={i} orderItem={oi} /> : null,
                  )}
                </div>
              ) : (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No items in this order
                </p>
              )}
            </div>

            <OrderTotalSection order={order} />
          </div>
        )}

        {/* ── Actions ── */}
        <div className="border-t border-border bg-background pt-4 space-y-3 shrink-0">
          {isAdmin && (canCreateEditInvoice || canDownloadInvoice) && (
            <div className="flex gap-2 pb-3 border-b border-border">
              {canCreateEditInvoice && (
                <Button
                  variant="outline"
                  onClick={handleCreateEditInvoice}
                  onMouseEnter={handlePrefetchInvoice}
                  onFocus={handlePrefetchInvoice}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {hasInvoice ? "Edit Invoice" : "Create Invoice"}
                </Button>
              )}
              {canDownloadInvoice && (
                <Button variant="outline" onClick={handleDownloadInvoice} disabled={isDownloading}>
                  {isDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download Invoice
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
              Close
            </Button>
            {canEditManualSale && (
              <Button variant="outline" onClick={handleEditManualSale} disabled={isDeleting}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Edit manual sale
              </Button>
            )}
            {canDeleteOrder && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Order
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* ── Delete confirmation ── */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(next) => {
          if (isDeleting) return;
          setDeleteDialogOpen(next);
          if (!next) setDeleteConfirmText("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Order</DialogTitle>
            <DialogDescription>
              This will remove the order and restore stock back to inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-semibold text-foreground">confirm</span> to continue.
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type confirm"
              disabled={isDeleting}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText("");
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrder}
              disabled={isDeleting || deleteConfirmText.trim().toLowerCase() !== "confirm"}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
