"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/lib/auth/context";
import { Database, Json } from "@/lib/database.types";
import { createNotificationEvent } from "@/lib/notifications/client";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/types";
import { queryKeys } from "@/lib/query-keys";
import {
  dbRowToOrder,
  deleteOrderRpc,
  fetchAllOrders,
  fetchOrderById,
  insertOrder,
  ORDER_FIELDS,
  updateManualSaleOrderRpc,
  updateOrderInDb,
} from "@/lib/supabase/queries";
import { percentToRate } from "@/lib/tax";
import { Order, OrderItem } from "@/types/order";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

function calculateOrderSubtotal(items: OrderItem[]): number {
  return items.reduce(
    (total, orderItem) =>
      total + (orderItem.item.sellingPrice ?? orderItem.item.pricePerUnit) * orderItem.quantity,
    0,
  );
}

const generateUUID = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export function useOrdersActions() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const queryClient = useQueryClient();

  // All orders for this company — replaces the old useState + useEffect + loadOrders.
  // Realtime invalidation is handled centrally by use-realtime-invalidation.ts in Providers.tsx.
  const { data: orders = [], isLoading } = useQuery({
    queryKey: queryKeys.ordersAll(companyId),
    queryFn: () => fetchAllOrders(companyId),
    staleTime: 30_000,
    enabled: Boolean(companyId),
  });

  /** Invalidates both the full list and the paginated pages. */
  const invalidateOrders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.ordersAll(companyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.orders });
  }, [companyId, queryClient]);

  const createManualOrder = useCallback(
    async (
      adminUserId: string,
      items: OrderItem[],
      customerInfo: { name: string; email?: string; phone?: string },
      paymentMethod: string,
      hstPercent?: number,
      billingAddress?: string,
      shippingAddress?: string,
      notes?: string,
    ): Promise<Order> => {
      if (!items || items.length === 0) {
        throw new Error("Order must have at least one item");
      }

      const subtotal = calculateOrderSubtotal(items);
      const taxRate = hstPercent && hstPercent > 0 ? percentToRate(hstPercent) : null;
      const taxAmount = taxRate ? Math.round(subtotal * taxRate * 100) / 100 : null;
      const totalPrice = subtotal + (taxAmount ?? 0);
      const itemsJson: Json = items as unknown as Json;

      const newOrder = {
        id: generateUUID(),
        user_id: adminUserId,
        company_id: companyId,
        items: itemsJson,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_price: totalPrice,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_manual_sale: true,
        manual_customer_name: customerInfo.name,
        manual_customer_email: customerInfo.email || null,
        manual_customer_phone: customerInfo.phone || null,
        payment_terms: paymentMethod,
        billing_address: billingAddress || null,
        shipping_address: shippingAddress || null,
        invoice_notes: notes || null,
      };

      const data = await insertOrder(newOrder);

      const createdOrder = dbRowToOrder(data);

      queryClient.setQueryData<Order[]>(queryKeys.ordersAll(companyId), (old) => [
        createdOrder,
        ...(old ?? []),
      ]);

      if (companyId) {
        await createNotificationEvent({
          actorUserId: adminUserId,
          companyId,
          entityId: createdOrder.id,
          entityType: "order",
          eventType: NOTIFICATION_EVENT_TYPES.manualSaleRecorded,
          message: `Manual sale recorded for ${customerInfo.name} (${items.length} item${items.length !== 1 ? "s" : ""}) totaling ${totalPrice.toFixed(2)}.`,
          metadata: {
            customerName: customerInfo.name,
            itemCount: items.length,
            totalPrice,
          },
          title: "Manual sale recorded",
        });
      }
      return createdOrder;
    },
    [companyId, queryClient],
  );

  const updateManualOrder = useCallback(
    async (orderId: string, items: OrderItem[], hstPercent?: number): Promise<Order> => {
      if (!items || items.length === 0) {
        throw new Error("Order must have at least one item");
      }

      const taxRate = hstPercent != null && hstPercent > 0 ? percentToRate(hstPercent) : null;

      await updateManualSaleOrderRpc(orderId, items as unknown as Json, taxRate);

      const updatedOrder = await fetchOrderById(orderId);

      // Invalidate all related caches; inventory quantities may have changed too.
      invalidateOrders();
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAll(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userOrdersBase });
      return updatedOrder;
    },
    [companyId, invalidateOrders, queryClient],
  );

  const patchManualSaleOrderDetails = useCallback(
    async (
      orderId: string,
      patch: {
        customerName?: string;
        customerEmail?: string;
        customerPhone?: string | null;
        paymentMethod?: string;
        billingAddress?: string | null;
        shippingAddress?: string | null;
        notes?: string | null;
      },
    ): Promise<void> => {
      const updateData: OrderUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (patch.customerName !== undefined) {
        updateData.manual_customer_name = patch.customerName;
      }
      if (patch.customerEmail !== undefined) {
        updateData.manual_customer_email = patch.customerEmail || null;
      }
      if (patch.customerPhone !== undefined) {
        updateData.manual_customer_phone = patch.customerPhone;
      }
      if (patch.paymentMethod !== undefined) {
        updateData.payment_terms = patch.paymentMethod;
      }
      if (patch.billingAddress !== undefined) {
        updateData.billing_address = patch.billingAddress;
      }
      if (patch.shippingAddress !== undefined) {
        updateData.shipping_address = patch.shippingAddress;
      }
      if (patch.notes !== undefined) {
        updateData.invoice_notes = patch.notes;
      }

      await updateOrderInDb(orderId, updateData);

      invalidateOrders();
    },
    [invalidateOrders],
  );

  const getOrderById = useCallback(
    (orderId: string): Order | undefined => {
      return orders.find((order) => order.id === orderId);
    },
    [orders],
  );

  const deleteOrder = useCallback(
    async (orderId: string): Promise<void> => {
      const deleted = await deleteOrderRpc(orderId);

      if (!deleted) {
        throw new Error("Order was already deleted.");
      }

      invalidateOrders();
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAll(companyId) });
    },
    [companyId, invalidateOrders, queryClient],
  );

  const getUserOrders = useCallback(
    (userId: string): Order[] => {
      return orders
        .filter((order) => order.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [orders],
  );

  const getAllOrders = useCallback((): Order[] => {
    return [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [orders]);

  const updateInvoice = useCallback(
    async (
      orderId: string,
      invoiceData: {
        invoiceNumber: string;
        invoiceDate: string;
        poNumber: string;
        paymentTerms: string;
        dueDate: string;
        hstNumber: string;
        invoiceNotes?: string | null;
        invoiceTerms?: string | null;
        discountAmount?: number;
        discountType?: string;
        shippingAmount?: number;
        imeiNumbers?: Record<string, string> | null;
      },
    ): Promise<void> => {
      // Fetch fresh from DB so subtotal/taxRate are authoritative, not a stale snapshot.
      const order = await fetchOrderById(orderId, companyId);

      const discountAmount = invoiceData.discountAmount || 0;
      const shippingAmount = invoiceData.shippingAmount || 0;
      const subtotal = order.subtotal;
      const taxRate = order.taxRate || 0;

      const result = subtotal - discountAmount + shippingAmount;
      const newTaxAmount = result * taxRate;
      const newTotal = Math.max(0, result + newTaxAmount);

      const imeiNumbersPayload: Record<string, string> = {};
      if (
        invoiceData.imeiNumbers &&
        typeof invoiceData.imeiNumbers === "object" &&
        !Array.isArray(invoiceData.imeiNumbers)
      ) {
        for (const [k, v] of Object.entries(invoiceData.imeiNumbers)) {
          if (typeof k === "string" && typeof v === "string") {
            imeiNumbersPayload[k] = v;
          }
        }
      }

      const updateData: OrderUpdate = {
        invoice_number: invoiceData.invoiceNumber,
        invoice_date: invoiceData.invoiceDate,
        po_number: invoiceData.poNumber,
        payment_terms: invoiceData.paymentTerms,
        due_date: invoiceData.dueDate,
        hst_number: invoiceData.hstNumber,
        invoice_notes: invoiceData.invoiceNotes ?? null,
        invoice_terms: invoiceData.invoiceTerms ?? null,
        discount_amount: discountAmount,
        discount_type: invoiceData.discountType || "cad",
        shipping_amount: shippingAmount,
        tax_amount: newTaxAmount,
        total_price: newTotal,
        invoice_confirmed: false,
        invoice_confirmed_at: null,
        updated_at: new Date().toISOString(),
        imei_numbers: imeiNumbersPayload,
      };

      await updateOrderInDb(orderId, updateData);

      invalidateOrders();
    },
    [companyId, invalidateOrders],
  );

  const confirmInvoice = useCallback(
    async (orderId: string): Promise<void> => {
      const updateData: OrderUpdate = {
        invoice_confirmed: true,
        invoice_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await updateOrderInDb(orderId, updateData);

      invalidateOrders();
    },
    [invalidateOrders],
  );

  const downloadInvoicePDF = useCallback(
    async (orderId: string): Promise<void> => {
      const order = await fetchOrderById(orderId, companyId);

      if (!order.invoiceNumber) throw new Error("Invoice not created yet");

      if (!companyId) throw new Error("Company not loaded");

      const { generateInvoicePDF } = await import("@/lib/invoice/pdf");
      const { getUserProfile } = await import("@/lib/supabase/utils");

      let customerInfo: {
        businessName: string | null;
        businessAddress: string | null;
        billingAddress: string | null;
        shippingAddress: string | null;
      };

      if (order.isManualSale) {
        customerInfo = {
          businessName: order.manualCustomerName || "Walk-in Customer",
          businessAddress:
            [order.manualCustomerEmail, order.manualCustomerPhone].filter(Boolean).join(" | ") ||
            null,
          billingAddress: order.billingAddress || null,
          shippingAddress: order.shippingAddress || null,
        };
      } else {
        const customerProfile = await getUserProfile(order.userId);
        customerInfo = {
          businessName: customerProfile?.businessName || null,
          businessAddress: customerProfile?.businessAddress || null,
          billingAddress: order.billingAddress || null,
          shippingAddress: order.shippingAddress || null,
        };
      }

      const invoiceData = {
        invoiceNumber: order.invoiceNumber,
        invoiceDate: order.invoiceDate || order.createdAt,
        poNumber: order.poNumber || "",
        paymentTerms: order.paymentTerms || "CHQ",
        dueDate: order.dueDate || order.createdAt,
        hstNumber: order.hstNumber || "",
        invoiceNotes: order.invoiceNotes,
        invoiceTerms: order.invoiceTerms,
      };

      await generateInvoicePDF(companyId, order, invoiceData, customerInfo);
    },
    [companyId],
  );

  const refreshOrders = useCallback(async (): Promise<void> => {
    await invalidateOrders();
  }, [invalidateOrders]);

  return {
    orders,
    createManualOrder,
    updateManualOrder,
    patchManualSaleOrderDetails,
    deleteOrder,
    updateInvoice,
    confirmInvoice,
    downloadInvoicePDF,
    getUserOrders,
    getAllOrders,
    getOrderById,
    refreshOrders,
    isLoading,
  };
}
