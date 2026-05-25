"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { removeTax } from "@/lib/tax";
import { useInventory } from "@/contexts/InventoryContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { toastError } from "@/lib/utils/toast-helpers";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { Order } from "@/types/order";
import { fetchIdentifierLabelsQuery } from "@/lib/supabase/queries";

interface UseOrderDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

export interface ProfitRow {
  itemName: string;
  storage: string;
  grade: string;
  quantity: number;
  sellingPerUnit: number;
  costPerUnit: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
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

export function useOrderDetails({ open, onOpenChange, order }: UseOrderDetailsProps) {
  const { startNavigation } = useNavigation();
  const { updateOrderStatus, downloadInvoicePDF, deleteOrder } = useOrders();
  const { inventory, refreshInventory } = useInventory();
  const { canWrite: isAdmin, slug: companySlug } = useCompany();
  const router = useRouter();

  // ── Dialog & Action States ────────────────────────────────────────────────
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeleteInFlightRef = useRef(false);

  // ── Database Loaded States ────────────────────────────────────────────────
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
  const orderStatus = order?.status;
  const orderUserId = order?.userId;
  const orderIsManualSale = order?.isManualSale;
  const orderItemsJsonKey = order?.items != null ? JSON.stringify(order.items) : "";

  // ── Fetch Identifiers Side-Effect ──────────────────────────────────────────
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

    fetchIdentifierLabelsQuery(allIdentifierIds)
      .then((data) => {
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
      })
      .catch((err) => {
        console.error("Failed to load identifier details:", err);
      });
  }, [open, orderId, orderItemsJsonKey, order]);

  // ── Fetch Customer Email Side-Effect ───────────────────────────────────────
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

  // ── Fetch Color Assignments Side-Effect ────────────────────────────────────
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

  // ── Permission Guards & Utility Flags ──────────────────────────────────────
  const invoiceRoute = order ? `/${companySlug}/orders/${order.id}/invoice` : "";

  const handlePrefetchInvoice = useCallback(() => {
    if (!order || !router || !invoiceRoute) return;
    router.prefetch(invoiceRoute);
  }, [invoiceRoute, order, router]);

  const canReject = order ? order.status === "pending" && isAdmin : false;
  const canDeleteOrder = order
    ? isAdmin && (order.status === "approved" || order.status === "completed")
    : false;
  const canEditManualSale = order
    ? isAdmin &&
      order.isManualSale === true &&
      (order.status === "approved" || order.status === "completed") &&
      order.invoiceConfirmed !== true
    : false;
  const hasInvoice = order ? !!order.invoiceNumber : false;
  const canDownloadInvoice = hasInvoice && isAdmin;
  const canCreateEditInvoice = order ? isAdmin && order.status === "approved" : false;

  // ── Action Event Handlers ──────────────────────────────────────────────────
  const handleReject = async (reason: string, comment: string) => {
    if (!order) return;
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
    if (!order) return;
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

  const handleDownloadInvoice = async () => {
    if (!order) return;
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
    if (!order) return;
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

  // ── Profit & Margin Memoizations ──────────────────────────────────────────
  const profitCalculations = useMemo(() => {
    if (!order) {
      return {
        profitRows: [],
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        totalMargin: 0,
      };
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];

    const rows: ProfitRow[] = orderItems
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

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      profitRows: rows,
      totalRevenue,
      totalCost,
      totalProfit,
      totalMargin,
    };
  }, [order, inventory]);

  return {
    // Action States
    isRejecting,
    rejectionDialogOpen,
    setRejectionDialogOpen,
    customerEmail,
    isDownloading,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteConfirmText,
    setDeleteConfirmText,
    isDeleting,

    // Dynamic Database Data
    colorAssignments,
    fetchedIdentifierLabels,
    fetchedIdentifierColors,
    fetchedIdentifierDamageNotes,

    // Navigation & Routes
    companySlug,
    isAdmin,
    handlePrefetchInvoice,

    // Handlers
    handleReject,
    handleDeleteOrder,
    handleDownloadInvoice,
    handleCreateEditInvoice,
    handleEditManualSale,

    // Permissions
    canReject,
    canDeleteOrder,
    canEditManualSale,
    hasInvoice,
    canDownloadInvoice,
    canCreateEditInvoice,

    // Math Calculations
    ...profitCalculations,
  };
}
