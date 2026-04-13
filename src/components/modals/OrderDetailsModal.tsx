import { useInventory } from "@/contexts/InventoryContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradeBadge } from "@/components/common/GradeBadge";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { cn } from "@/lib/utils";
import { formatDateTimeInOntario } from "@/lib/utils/formatters";
import { Order } from "@/types/order";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Palette,
  ShoppingBag,
  Trash2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getStatusColor, getStatusLabel } from "@/lib/utils/status";

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
  if (purchasePrice != null) {
    return purchasePrice / quantity;
  }
  if (hst != null && hst > 0) {
    return pricePerUnit / (1 + hst / 100);
  }
  return pricePerUnit;
};

export const OrderDetailsModal = ({ open, onOpenChange, order }: OrderDetailsModalProps) => {
  const { startNavigation } = useNavigation();
  const { updateOrderStatus, downloadInvoicePDF, deleteOrder, refreshOrders } = useOrders();
  // Only access inventory when modal is open to avoid unnecessary re-renders
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
  // Colour assignments for fulfilled orders — admin-only, never exposed to users
  const [colorAssignments, setColorAssignments] = useState<
    Record<string, { color: string; quantity: number }[]>
  >({});

  // identifierLabel keyed by inventoryIdentifierId — fetched for items that pre-date
  // the identifierLabel field being stored in the order JSON.
  const [fetchedIdentifierLabels, setFetchedIdentifierLabels] = useState<Record<string, string>>(
    {},
  );
  // Per-unit color keyed by inventoryIdentifierId
  const [fetchedIdentifierColors, setFetchedIdentifierColors] = useState<Record<string, string>>(
    {},
  );

  // Stable keys: `order` from the parent is often a new object reference on every list/query
  // refresh, which would retrigger effects that listed `order` in deps and spam APIs.
  const orderId = order?.id;
  const orderStatus = order?.status;
  const orderUserId = order?.userId;
  const orderIsManualSale = order?.isManualSale;
  /** Content-based key so `order.items` reference churn does not retrigger fetches. */
  const orderItemsJsonKey = order?.items != null ? JSON.stringify(order.items) : "";

  useEffect(() => {
    if (!open || !order) {
      setFetchedIdentifierLabels({});
      setFetchedIdentifierColors({});
      return;
    }
    const items = Array.isArray(order.items) ? order.items : [];
    // Fetch labels for items missing stored label, and colors for all identified items
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
    const fetchCustomerEmail = async () => {
      if (!orderUserId || orderIsManualSale) return;

      try {
        const response = await fetch("/api/users/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userIds: [orderUserId] }),
        });

        if (response.ok) {
          const data = await response.json();
          setCustomerEmail(data.emails[orderUserId] || null);
        }
      } catch {
        // Silently handle error - email is optional
      }
    };

    if (open && orderUserId) {
      void fetchCustomerEmail();
    }
  }, [open, orderIsManualSale, orderUserId]);

  // Fetch colour assignments when admin opens an approved/completed order
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

  // Invoice route — must be computed before any early return so hooks below stay stable
  const invoiceRoute = order ? `/${companySlug}/orders/${order.id}/invoice` : "";

  const handlePrefetchInvoice = useCallback(() => {
    if (!order || !router || !invoiceRoute) return;
    router.prefetch(invoiceRoute);
  }, [invoiceRoute, order, router]);

  if (!order) return null;

  const orderItems = Array.isArray(order.items) ? order.items : [];
  const profitRows = orderItems
    .filter((orderItem) => orderItem?.item)
    .map((orderItem) => {
      // The order snapshot may have been created from a user session (public fields only),
      // so purchasePrice / hst may be missing. Fall back to the live inventory item which
      // the admin context loads with full admin fields.
      const liveItem = inventory.find((inv) => inv.id === orderItem.item.id);
      const purchasePriceSnap = orderItem.item.purchasePrice ?? liveItem?.purchasePrice ?? null;
      const hstSnap = orderItem.item.hst ?? liveItem?.hst ?? null;
      const pricePerUnitSnap = orderItem.item.pricePerUnit || 0 || (liveItem?.pricePerUnit ?? 0);

      const qty = orderItem.quantity || 0;
      const sellingPerUnit = orderItem.item.sellingPrice ?? orderItem.item.pricePerUnit ?? 0;
      const batchQty = orderItem.item.quantity ?? 1;
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
        itemName: orderItem.item.deviceName || "Unknown Device",
        storage: orderItem.item.storage || "N/A",
        grade: orderItem.item.grade || "N/A",
        quantity: qty,
        sellingPerUnit,
        costPerUnit,
        revenue,
        cost,
        profit,
        margin,
      };
    });

  const totalRevenue = profitRows.reduce((sum, row) => sum + row.revenue, 0);
  const totalCost = profitRows.reduce((sum, row) => sum + row.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const checkStockAvailability = (): InsufficientStockItem[] => {
    const items = orderItems;
    const insufficientItems: InsufficientStockItem[] = [];

    for (const orderItem of items) {
      if (!orderItem?.item?.id || !orderItem?.quantity) continue;

      const inventoryItem = inventory.find((inv) => inv.id === orderItem.item.id);
      const availableQty = inventoryItem?.quantity ?? 0;

      if (availableQty < orderItem.quantity) {
        insufficientItems.push({
          deviceName: orderItem.item.deviceName || "Unknown Device",
          requestedQty: orderItem.quantity,
          availableQty,
        });
      }
    }

    return insufficientItems;
  };

  const handleFulfillmentSuccess = async () => {
    // Refresh inventory and orders (the server route already updated inventory + order status)
    await Promise.all([refreshInventory(), refreshOrders()]);
    toast.success(TOAST_MESSAGES.ORDER_APPROVED(order.id));
    setStockWarningDialogOpen(false);
    setColorFulfillmentOpen(false);
    onOpenChange(false);
  };

  const openColorFulfillment = () => {
    setStockWarningDialogOpen(false);
    setColorFulfillmentOpen(true);
  };

  const handleApprove = () => {
    const items = Array.isArray(order.items) ? order.items : [];

    if (items.length === 0) {
      toast.error(TOAST_MESSAGES.ORDER_NO_ITEMS);
      return;
    }

    const insufficientItems = checkStockAvailability();

    if (insufficientItems.length > 0) {
      setInsufficientStockItems(insufficientItems);
      setStockWarningDialogOpen(true);
      return;
    }

    // Open colour fulfillment dialog
    openColorFulfillment();
  };

  const handleApproveAnyway = () => {
    openColorFulfillment();
  };

  const handleRejectFromWarning = () => {
    setStockWarningDialogOpen(false);
    setRejectionDialogOpen(true);
  };

  const handleCancelWarning = () => {
    setStockWarningDialogOpen(false);
    setInsufficientStockItems([]);
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

  // Only admins can approve or reject orders
  const canApprove = order.status === "pending" && isAdmin;
  const canReject = order.status === "pending" && isAdmin;
  const canDeleteOrder = isAdmin && (order.status === "approved" || order.status === "completed");

  const canEditManualSale =
    isAdmin &&
    order.isManualSale === true &&
    (order.status === "approved" || order.status === "completed") &&
    order.invoiceConfirmed !== true;

  // Invoice actions
  const hasInvoice = !!order.invoiceNumber;
  const canDownloadInvoice = hasInvoice && isAdmin;
  const canCreateEditInvoice = isAdmin && order.status === "approved";

  const handleDownloadInvoice = async () => {
    if (!order) return;

    setIsDownloading(true);
    try {
      await downloadInvoicePDF(order.id);
      toast.success(TOAST_MESSAGES.INVOICE_DOWNLOADED);
    } catch (error) {
      toast.error(TOAST_MESSAGES.INVOICE_DOWNLOAD_FAILED);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCreateEditInvoice = () => {
    if (!order) {
      return;
    }

    startNavigation();
    router.push(invoiceRoute);
    onOpenChange(false);
  };

  const handleEditManualSale = () => {
    if (!order || !companySlug) return;
    startNavigation();
    onOpenChange(false);
    router.push(`/${companySlug}/orders/manual-sale/edit/${order.id}`);
  };

  const handleDeleteOrder = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== "confirm") return;
    if (isDeleteInFlightRef.current) return;

    isDeleteInFlightRef.current = true;
    setIsDeleting(true);
    try {
      await deleteOrder(order.id);
      // Explicitly refresh inventory so HST reconciliation and inventory
      // views update immediately without waiting for the realtime event.
      await refreshInventory();
      toast.success("Order deleted and stock restored successfully.");
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete order. Please try again.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      isDeleteInFlightRef.current = false;
    }
  };

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

            <TabsContent
              value="order"
              className="flex-1 min-h-0 mt-3 overflow-y-auto overflow-x-hidden pr-1 data-[state=active]:flex data-[state=active]:flex-col"
            >
              <div className="space-y-6 pb-3">
                {/* Manual Sale Banner */}
                {order.isManualSale && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-50 border border-orange-200 dark:bg-orange-950 dark:border-orange-800 text-sm text-orange-700 dark:text-orange-400">
                    <ShoppingBag className="h-4 w-4 flex-shrink-0" />
                    <span>
                      This is a manually recorded sale — it was created directly by an admin.
                    </span>
                  </div>
                )}

                {/* Order Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Order Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Customer:</span>
                      {order.isManualSale ? (
                        <>
                          <p className="font-medium text-foreground mt-1">
                            {order.manualCustomerName || "Walk-in Customer"}
                          </p>
                          {order.manualCustomerEmail && (
                            <p className="text-xs text-muted-foreground">
                              {order.manualCustomerEmail}
                            </p>
                          )}
                          {order.manualCustomerPhone && (
                            <p className="text-xs text-muted-foreground">
                              {order.manualCustomerPhone}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="font-medium text-foreground mt-1">
                          {customerEmail || order.userId.slice(0, 8) + "..."}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Order Date:</span>
                      <p className="font-medium text-foreground mt-1">
                        {formatDateTimeInOntario(order.createdAt)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Updated:</span>
                      <p className="font-medium text-foreground mt-1">
                        {formatDateTimeInOntario(order.updatedAt)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Items:</span>
                      <p className="font-medium text-foreground mt-1">
                        {Array.isArray(order.items) ? order.items.length : 0} item(s)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Order Items</h3>
                  <div className="space-y-3">
                    {Array.isArray(order.items) && order.items.length > 0 ? (
                      order.items.map((orderItem, index) => {
                        if (!orderItem?.item) return null;
                        const itemColors = colorAssignments[orderItem.item.id] ?? [];
                        return (
                          <div
                            key={index}
                            className="p-4 bg-muted/50 rounded-lg border border-border"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h4 className="font-medium text-foreground">
                                  {orderItem.item.deviceName || "Unknown Device"}
                                </h4>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {orderItem.item.grade && (
                                    <GradeBadge grade={orderItem.item.grade} />
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {orderItem.item.storage || "N/A"}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                                    Quantity: {orderItem.quantity || 0}
                                  </span>
                                </div>
                                {/* IMEI / serial — from stored label or fetched fallback */}
                                {(orderItem.identifierLabel ||
                                  (orderItem.inventoryIdentifierId &&
                                    fetchedIdentifierLabels[orderItem.inventoryIdentifierId])) && (
                                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground">
                                      IMEI/Serial:
                                    </span>
                                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground select-all">
                                      {orderItem.identifierLabel ??
                                        fetchedIdentifierLabels[orderItem.inventoryIdentifierId!]}
                                    </span>
                                    {orderItem.inventoryIdentifierId &&
                                      fetchedIdentifierColors[orderItem.inventoryIdentifierId] && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                          {fetchedIdentifierColors[orderItem.inventoryIdentifierId]}
                                        </span>
                                      )}
                                  </div>
                                )}
                                {/* Colour breakdown — admin only */}
                                {itemColors.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                                    <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    {itemColors.map((c) => (
                                      <span
                                        key={c.color}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                                      >
                                        {c.color}
                                        <span className="text-primary/70">×{c.quantity}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm text-muted-foreground whitespace-nowrap">
                                  {formatPrice(
                                    orderItem.item.sellingPrice ?? orderItem.item.pricePerUnit ?? 0,
                                  )}{" "}
                                  each
                                </p>
                                <p className="font-semibold text-foreground mt-1 whitespace-nowrap">
                                  {formatPrice(
                                    (orderItem.item.sellingPrice ??
                                      orderItem.item.pricePerUnit ??
                                      0) * (orderItem.quantity || 0),
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No items in this order
                      </div>
                    )}
                  </div>
                </div>

                {/* Rejection Info */}
                {order.status === "rejected" &&
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
                              <p className="text-xs text-muted-foreground">
                                {order.rejectionComment}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Order Total */}
                <div className="border-t border-border pt-4 space-y-2">
                  {/* Subtotal (first line) */}
                  {order.subtotal !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium text-foreground">
                        {formatPrice(order.subtotal)}
                      </span>
                    </div>
                  )}
                  {order.discountAmount != null && order.discountAmount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="font-medium text-success">
                        -{formatPrice(order.discountAmount)}
                      </span>
                    </div>
                  )}
                  {order.shippingAmount != null && order.shippingAmount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Shipping:</span>
                      <span className="font-medium text-foreground">
                        {formatPrice(order.shippingAmount)}
                      </span>
                    </div>
                  )}
                  {/* Result (subtotal - discount + shipping) */}
                  {(() => {
                    const discount = order.discountAmount || 0;
                    const shipping = order.shippingAmount || 0;
                    const result = (order.subtotal || 0) - discount + shipping;

                    if (discount > 0 || shipping > 0) {
                      return (
                        <div className="flex items-center justify-between text-sm pt-1">
                          <span className="text-muted-foreground font-medium">Result:</span>
                          <span className="font-semibold text-foreground">
                            {formatPrice(result)}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {/* Tax (fourth line) - applied to result */}
                  {order.taxAmount && order.taxRate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Tax ({(order.taxRate * 100).toFixed(2)}%):
                      </span>
                      <span className="font-medium text-foreground">
                        {formatPrice(order.taxAmount)}
                      </span>
                    </div>
                  )}
                  {/* Total (final amount) */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-base sm:text-lg font-semibold text-foreground">
                      Total:
                    </span>
                    <span className="text-xl sm:text-2xl font-bold text-primary">
                      {formatPrice(order.totalPrice)}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

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
                    profitRows.map((row, index) => (
                      <div
                        key={`${row.itemName}-${index}`}
                        className="rounded-lg border border-border bg-card p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{row.itemName}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.storage} • Grade {row.grade} • Qty {row.quantity}
                            </p>
                          </div>
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              row.profit >= 0 ? "text-emerald-600" : "text-destructive",
                            )}
                          >
                            {formatPrice(row.profit)}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="rounded-md bg-muted/40 p-2">
                            <p className="text-muted-foreground">Sell / unit</p>
                            <p className="font-medium text-foreground">
                              {formatPrice(row.sellingPerUnit)}
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <p className="text-muted-foreground">Cost / unit</p>
                            <p className="font-medium text-foreground">
                              {formatPrice(row.costPerUnit)}
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <p className="text-muted-foreground">Revenue</p>
                            <p className="font-medium text-foreground">
                              {formatPrice(row.revenue)}
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <p className="text-muted-foreground">Margin</p>
                            <p className="font-medium text-foreground">
                              {row.margin != null ? `${row.margin.toFixed(2)}%` : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
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
            {/* Manual Sale Banner */}
            {order.isManualSale && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-50 border border-orange-200 dark:bg-orange-950 dark:border-orange-800 text-sm text-orange-700 dark:text-orange-400">
                <ShoppingBag className="h-4 w-4 flex-shrink-0" />
                <span>This is a manually recorded sale — it was created directly by an admin.</span>
              </div>
            )}

            {/* Order Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Order Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Customer:</span>
                  {order.isManualSale ? (
                    <>
                      <p className="font-medium text-foreground mt-1">
                        {order.manualCustomerName || "Walk-in Customer"}
                      </p>
                      {order.manualCustomerEmail && (
                        <p className="text-xs text-muted-foreground">{order.manualCustomerEmail}</p>
                      )}
                      {order.manualCustomerPhone && (
                        <p className="text-xs text-muted-foreground">{order.manualCustomerPhone}</p>
                      )}
                    </>
                  ) : (
                    <p className="font-medium text-foreground mt-1">
                      {customerEmail || order.userId.slice(0, 8) + "..."}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Order Date:</span>
                  <p className="font-medium text-foreground mt-1">
                    {formatDateTimeInOntario(order.createdAt)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>
                  <p className="font-medium text-foreground mt-1">
                    {formatDateTimeInOntario(order.updatedAt)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Items:</span>
                  <p className="font-medium text-foreground mt-1">
                    {Array.isArray(order.items) ? order.items.length : 0} item(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Order Items</h3>
              <div className="space-y-3">
                {Array.isArray(order.items) && order.items.length > 0 ? (
                  order.items.map((orderItem, index) => {
                    if (!orderItem?.item) return null;
                    return (
                      <div key={index} className="p-4 bg-muted/50 rounded-lg border border-border">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground">
                              {orderItem.item.deviceName || "Unknown Device"}
                            </h4>
                            <div className="flex items-center gap-2 mt-2">
                              {orderItem.item.grade && <GradeBadge grade={orderItem.item.grade} />}
                              <Badge variant="outline" className="text-xs">
                                {orderItem.item.storage || "N/A"}
                              </Badge>
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                Quantity: {orderItem.quantity || 0}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatPrice(
                                orderItem.item.sellingPrice ?? orderItem.item.pricePerUnit ?? 0,
                              )}{" "}
                              each
                            </p>
                            <p className="font-semibold text-foreground mt-1 whitespace-nowrap">
                              {formatPrice(
                                (orderItem.item.sellingPrice ?? orderItem.item.pricePerUnit ?? 0) *
                                  (orderItem.quantity || 0),
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No items in this order
                  </div>
                )}
              </div>
            </div>

            {/* Rejection Info */}
            {order.status === "rejected" && (order.rejectionReason || order.rejectionComment) && (
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
            )}

            {/* Order Total */}
            <div className="border-t border-border pt-4 space-y-2">
              {/* Subtotal (first line) */}
              {order.subtotal !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium text-foreground">{formatPrice(order.subtotal)}</span>
                </div>
              )}
              {order.discountAmount != null && order.discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="font-medium text-success">
                    -{formatPrice(order.discountAmount)}
                  </span>
                </div>
              )}
              {order.shippingAmount != null && order.shippingAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping:</span>
                  <span className="font-medium text-foreground">
                    {formatPrice(order.shippingAmount)}
                  </span>
                </div>
              )}
              {(() => {
                const discount = order.discountAmount || 0;
                const shipping = order.shippingAmount || 0;
                const result = (order.subtotal || 0) - discount + shipping;

                if (discount > 0 || shipping > 0) {
                  return (
                    <div className="flex items-center justify-between text-sm pt-1">
                      <span className="text-muted-foreground font-medium">Result:</span>
                      <span className="font-semibold text-foreground">{formatPrice(result)}</span>
                    </div>
                  );
                }
                return null;
              })()}
              {order.taxAmount && order.taxRate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({(order.taxRate * 100).toFixed(2)}%):
                  </span>
                  <span className="font-medium text-foreground">
                    {formatPrice(order.taxAmount)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-lg font-semibold text-foreground">Total:</span>
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(order.totalPrice)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-border bg-background pt-4 space-y-3 shrink-0">
          {/* Admin Invoice Actions */}
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

          {/* Order Actions */}
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

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (isDeleting) return;
          setDeleteDialogOpen(nextOpen);
          if (!nextOpen) {
            setDeleteConfirmText("");
          }
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
        onCancel={handleCancelWarning}
        onReject={handleRejectFromWarning}
        onApproveAnyway={handleApproveAnyway}
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
