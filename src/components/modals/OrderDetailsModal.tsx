"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  ShoppingBag,
  Trash2,
  XCircle,
} from "lucide-react";
import { removeTax } from "@/lib/tax";
import { useInventory } from "@/contexts/InventoryContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderRejectionDialog } from "@/components/modals/OrderRejectionDialog";
import { OrderColorFulfillmentDialog } from "@/components/modals/OrderColorFulfillmentDialog";
import {
  OutOfStockWarningDialog,
  InsufficientStockItem,
} from "@/components/modals/OutOfStockWarningDialog";
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
import { getStatusColor, getStatusLabel } from "@/lib/utils/status";
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
  const { updateOrderStatus, downloadInvoicePDF, deleteOrder, refreshOrders } = useOrders();
  const { inventory, refreshInventory } = useInventory();
  const { canWrite: isAdmin, slug: companySlug } = useCompany();
  const router = useRouter();

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [colorFulfillmentOpen, setColorFulfillmentOpen] = useState(false);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [stockWarningDialogOpen, setStockWarningDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeleteInFlightRef = useRef(false);
  const [insufficientStockItems, setInsufficientStockItems] = useState<InsufficientStockItem[]>([]);
  const [colorAssignments, setColorAssignments] = useState<
    Record<string, { color: string; quantity: number }[]>
  >({});
  const [fetchedIdentifierLabels, setFetchedIdentifierLabels] = useState<Record<string, string>>(
    {},
  );
  const [fetchedIdentifierColors, setFetchedIdentifierColors] = useState<Record<string, string>>(
    {},
  );

  const orderId = order?.id;
  const orderStatus = order?.status;
  const orderUserId = order?.userId;
  const orderIsManualSale = order?.isManualSale;
  const orderItemsJsonKey = order?.items != null ? JSON.stringify(order.items) : "";

  useEffect(() => {
    if (!open || !order) {
      setFetchedIdentifierLabels({});
      setFetchedIdentifierColors({});
      return;
    }
    const items = Array.isArray(order.items) ? order.items : [];
    const allIdentifierIds = items
      .filter((oi) => oi.inventoryIdentifierId)
      .map((oi) => oi.inventoryIdentifierId as string);

    if (allIdentifierIds.length === 0) return;

    (supabase as any)
      .from("inventory_identifiers")
      .select("id, imei, serial_number, color")
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
              }[]
            | null;
        }) => {
          if (!data) return;
          const labelMap: Record<string, string> = {};
          const colorMap: Record<string, string> = {};
          for (const row of data) {
            labelMap[row.id] = row.imei ?? row.serial_number ?? row.id;
            if (row.color) colorMap[row.id] = row.color;
          }
          setFetchedIdentifierLabels(labelMap);
          setFetchedIdentifierColors(colorMap);
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
    if (orderStatus !== "approved" && orderStatus !== "completed") {
      setColorAssignments({});
      return;
    }
    fetch(`/api/admin/order-color-assignments?order_id=${encodeURIComponent(orderId)}`)
      .then((r) => (r.ok ? r.json() : { assignments: {} }))
      .then((data) => setColorAssignments(data.assignments ?? {}))
      .catch(() => setColorAssignments({}));
  }, [open, isAdmin, orderId, orderStatus]);

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
  const checkStockAvailability = (): InsufficientStockItem[] =>
    orderItems.reduce<InsufficientStockItem[]>((acc, oi) => {
      if (!oi?.item?.id || !oi?.quantity) return acc;
      const inv = inventory.find((i) => i.id === oi.item.id);
      const available = inv?.quantity ?? 0;
      if (available < oi.quantity) {
        acc.push({
          deviceName: oi.item.deviceName || "Unknown Device",
          requestedQty: oi.quantity,
          availableQty: available,
        });
      }
      return acc;
    }, []);

  const openColorFulfillment = () => {
    setStockWarningDialogOpen(false);
    setColorFulfillmentOpen(true);
  };

  const handleFulfillmentSuccess = async () => {
    await Promise.all([refreshInventory(), refreshOrders()]);
    toast.success(TOAST_MESSAGES.ORDER_APPROVED(order.id));
    setStockWarningDialogOpen(false);
    setColorFulfillmentOpen(false);
    onOpenChange(false);
  };

  const handleApprove = () => {
    if (orderItems.length === 0) {
      toast.error(TOAST_MESSAGES.ORDER_NO_ITEMS);
      return;
    }
    const insufficient = checkStockAvailability();
    if (insufficient.length > 0) {
      setInsufficientStockItems(insufficient);
      setStockWarningDialogOpen(true);
      return;
    }
    openColorFulfillment();
  };

  const handleReject = async (reason: string, comment: string) => {
    setIsRejecting(true);
    try {
      await updateOrderStatus(order.id, "rejected", reason, comment);
      toast.success(TOAST_MESSAGES.ORDER_REJECTED(order.id));
      onOpenChange(false);
    } catch (error) {
      toast.error(TOAST_MESSAGES.ORDER_FAILED_REJECT);
      throw error;
    } finally {
      setIsRejecting(false);
    }
  };

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
  const canApprove = order.status === "pending" && isAdmin;
  const canReject = order.status === "pending" && isAdmin;
  const canDeleteOrder = isAdmin && (order.status === "approved" || order.status === "completed");
  const canEditManualSale =
    isAdmin &&
    order.isManualSale === true &&
    (order.status === "approved" || order.status === "completed") &&
    order.invoiceConfirmed !== true;
  const hasInvoice = !!order.invoiceNumber;
  const canDownloadInvoice = hasInvoice && isAdmin;
  const canCreateEditInvoice = isAdmin && order.status === "approved";

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

  const rejectionInfo = order.status === "rejected" &&
    (order.rejectionReason || order.rejectionComment) && (
      <div className="border-t border-border pt-3">
        <div className="px-3 py-2 bg-destructive/10 rounded-md border border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="text-xs font-medium text-destructive">Rejected</p>
              {order.rejectionReason && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Reason:</span> {order.rejectionReason}
                </p>
              )}
              {order.rejectionComment && (
                <p className="text-xs text-muted-foreground">{order.rejectionComment}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader>
          <div className="flex items-start justify-between pr-8">
            <div>
              <DialogTitle>Order #{order.id.slice(-8).toUpperCase()}</DialogTitle>
              <DialogDescription>Order details and summary</DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={cn("text-sm flex-shrink-0", getStatusColor(order.status))}
            >
              {getStatusLabel(order.status)}
            </Badge>
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

                {rejectionInfo}
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

            {rejectionInfo}
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
                  disabled={isApproving || isRejecting}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {hasInvoice ? "Edit Invoice" : "Create Invoice"}
                </Button>
              )}
              {canDownloadInvoice && (
                <Button
                  variant="outline"
                  onClick={handleDownloadInvoice}
                  disabled={isDownloading || isApproving || isRejecting}
                >
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
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isApproving || isRejecting || isDeleting}
            >
              Close
            </Button>
            {canEditManualSale && (
              <Button
                variant="outline"
                onClick={handleEditManualSale}
                disabled={isApproving || isRejecting || isDeleting}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Edit manual sale
              </Button>
            )}
            {canDeleteOrder && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isApproving || isRejecting || isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Order
              </Button>
            )}
            {canReject && (
              <Button
                variant="destructive"
                onClick={() => setRejectionDialogOpen(true)}
                disabled={isApproving || isRejecting || isDeleting}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Order
              </Button>
            )}
            {canApprove && (
              <Button onClick={handleApprove} disabled={isApproving || isRejecting || isDeleting}>
                {isApproving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Approve Order"
                )}
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
              Order is confirmed still you want to delete it? This will remove the order and restore
              stock back to inventory.
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

      <OrderRejectionDialog
        open={rejectionDialogOpen}
        onOpenChange={setRejectionDialogOpen}
        onReject={handleReject}
      />

      <OutOfStockWarningDialog
        open={stockWarningDialogOpen}
        onOpenChange={setStockWarningDialogOpen}
        insufficientItems={insufficientStockItems}
        onCancel={() => {
          setStockWarningDialogOpen(false);
          setInsufficientStockItems([]);
        }}
        onReject={() => {
          setStockWarningDialogOpen(false);
          setRejectionDialogOpen(true);
        }}
        onApproveAnyway={openColorFulfillment}
        isApproving={isApproving}
      />

      <OrderColorFulfillmentDialog
        open={colorFulfillmentOpen}
        onOpenChange={setColorFulfillmentOpen}
        orderId={order.id}
        orderItems={orderItems}
        onSuccess={handleFulfillmentSuccess}
      />
    </Dialog>
  );
};
