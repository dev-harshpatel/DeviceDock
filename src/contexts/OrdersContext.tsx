"use client";

import { Database, Json } from "@/lib/database.types";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";
import { useCompany } from "@/contexts/CompanyContext";
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { Order, OrderItem, OrderStatus } from "@/types/order";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { dbRowToOrder, ORDER_FIELDS } from "@/lib/supabase/queries";
import { createNotificationEvent } from "@/lib/notifications/client";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/types";

export interface OrderAddresses {
  shippingAddress: string | null;
  billingAddress: string | null;
}

interface OrdersContextType {
  orders: Order[];
  createOrder: (
    userId: string,
    items: OrderItem[],
    subtotal?: number,
    taxRate?: number,
    taxAmount?: number,
    addresses?: OrderAddresses,
  ) => Promise<Order>;
  createManualOrder: (
    adminUserId: string,
    items: OrderItem[],
    customerInfo: { name: string; email?: string; phone?: string },
    paymentMethod: string,
    hstPercent?: number,
    billingAddress?: string,
    shippingAddress?: string,
    notes?: string,
  ) => Promise<Order>;
  updateManualOrder: (orderId: string, items: OrderItem[], hstPercent?: number) => Promise<Order>;
  patchManualSaleOrderDetails: (
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
  ) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    rejectionReason?: string,
    rejectionComment?: string,
    discountAmount?: number,
  ) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  updateInvoice: (
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
  ) => Promise<void>;
  confirmInvoice: (orderId: string) => Promise<void>;
  downloadInvoicePDF: (orderId: string) => Promise<void>;
  getUserOrders: (userId: string) => Order[];
  getAllOrders: () => Order[];
  getOrderById: (orderId: string) => Order | undefined;
  refreshOrders: () => Promise<void>;
  isLoading: boolean;
}

export const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider");
  }
  return context;
};

interface OrdersProviderProps {
  children: ReactNode;
}

type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
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

const buildOrderInsert = (
  userId: string,
  companyId: string,
  items: OrderItem[],
  subtotal?: number,
  taxRate?: number,
  taxAmount?: number,
  addresses?: OrderAddresses,
): OrderInsert => {
  const calculatedSubtotal = subtotal ?? calculateOrderSubtotal(items);
  const calculatedTaxAmount =
    taxAmount ?? (taxRate ? Math.round(calculatedSubtotal * taxRate * 100) / 100 : 0);
  const totalPrice = calculatedSubtotal + calculatedTaxAmount;
  const itemsJson: Json = items as unknown as Json;

  return {
    id: generateUUID(),
    user_id: userId,
    company_id: companyId,
    items: itemsJson,
    subtotal: calculatedSubtotal,
    tax_rate: taxRate ?? null,
    tax_amount: calculatedTaxAmount > 0 ? calculatedTaxAmount : null,
    total_price: totalPrice,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    shipping_address: addresses?.shippingAddress ?? null,
    billing_address: addresses?.billingAddress ?? null,
  } as OrderInsert;
};

export const OrdersProvider = ({ children }: OrdersProviderProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { ordersVersion } = useRealtimeContext();
  const queryClient = useQueryClient();

  // Load orders from Supabase — filtered by company_id
  const loadOrders = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data, error } = await (supabase.from("orders") as any)
        .select(ORDER_FIELDS)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) {
        setOrders([]);
        return;
      }

      setOrders(data ? data.map(dbRowToOrder) : []);
    } catch {
      setOrders([]);
    }
  }, [companyId]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setIsLoading(true);
      await loadOrders();
      if (isMounted) setIsLoading(false);
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [loadOrders]);

  // Reload orders when RealtimeProvider signals orders changes
  useEffect(() => {
    if (ordersVersion > 0) {
      loadOrders();
    }
  }, [ordersVersion, loadOrders]);

  const createOrder = useCallback(
    async (
      userId: string,
      items: OrderItem[],
      subtotal?: number,
      taxRate?: number,
      taxAmount?: number,
      addresses?: OrderAddresses,
    ): Promise<Order> => {
      if (!items || items.length === 0) {
        throw new Error("Order must have at least one item");
      }

      const newOrder = buildOrderInsert(
        userId,
        companyId,
        items,
        subtotal,
        taxRate,
        taxAmount,
        addresses,
      );

      const { data, error } = await (supabase.from("orders") as any)
        .insert([newOrder])
        .select()
        .single();

      if (error) {
        throw new Error(error.message || "Failed to create order");
      }

      if (data) {
        const createdOrder = dbRowToOrder(data);
        setOrders((prev) => [createdOrder, ...prev]);
        return createdOrder;
      }

      const fallbackSubtotal = subtotal ?? calculateOrderSubtotal(items);
      const fallbackTaxAmount =
        taxAmount ?? (taxRate ? Math.round(fallbackSubtotal * taxRate * 100) / 100 : 0);
      const fallbackTotalPrice = fallbackSubtotal + fallbackTaxAmount;

      return {
        id: newOrder.id ?? "",
        userId: newOrder.user_id,
        items,
        subtotal: Number((newOrder as any).subtotal ?? fallbackSubtotal),
        taxRate: (newOrder as any).tax_rate
          ? Number((newOrder as any).tax_rate)
          : (taxRate ?? null),
        taxAmount: (newOrder as any).tax_amount
          ? Number((newOrder as any).tax_amount)
          : fallbackTaxAmount > 0
            ? fallbackTaxAmount
            : null,
        totalPrice: Number(newOrder.total_price ?? fallbackTotalPrice),
        status: (newOrder.status ?? "pending") as OrderStatus,
        createdAt: newOrder.created_at ?? new Date().toISOString(),
        updatedAt: newOrder.updated_at ?? new Date().toISOString(),
      };
    },
    [companyId],
  );

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
      const taxRate = hstPercent && hstPercent > 0 ? hstPercent / 100 : null;
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
        status: "approved",
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

      const { data, error } = await (supabase.from("orders") as any)
        .insert([newOrder])
        .select()
        .single();

      if (error) {
        throw new Error(error.message || "Failed to record sale");
      }

      const createdOrder = dbRowToOrder(data);
      setOrders((prev) => [createdOrder, ...prev]);
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
    [companyId],
  );

  const updateManualOrder = useCallback(
    async (orderId: string, items: OrderItem[], hstPercent?: number): Promise<Order> => {
      if (!items || items.length === 0) {
        throw new Error("Order must have at least one item");
      }

      const taxRate = hstPercent != null && hstPercent > 0 ? hstPercent / 100 : null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated Database types
      const { error: rpcError } = await (supabase as any).rpc("update_manual_sale_order", {
        p_order_id: orderId,
        p_items: items as unknown as Json,
        p_tax_rate: taxRate,
      });

      if (rpcError) {
        throw new Error(rpcError.message || "Failed to update manual sale order");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("orders") as any)
        .select(ORDER_FIELDS)
        .eq("id", orderId)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to load updated order");
      }

      const updatedOrder = dbRowToOrder(data);
      await loadOrders();
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      queryClient.invalidateQueries({ queryKey: ["paginated", "userOrders"] });
      return updatedOrder;
    },
    [loadOrders, queryClient],
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("orders") as any).update(updateData).eq("id", orderId);

      if (error) {
        throw new Error(error.message || "Failed to update order details");
      }

      await loadOrders();
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    },
    [loadOrders, queryClient],
  );

  const getOrderById = useCallback(
    (orderId: string): Order | undefined => {
      return orders.find((order) => order.id === orderId);
    },
    [orders],
  );

  const updateOrderStatus = useCallback(
    async (
      orderId: string,
      status: OrderStatus,
      rejectionReason?: string,
      rejectionComment?: string,
      discountAmount?: number,
    ) => {
      const updateData: OrderUpdate = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "approved" && discountAmount !== undefined) {
        (updateData as any).discount_amount = discountAmount;
        const order = getOrderById(orderId);
        if (order) {
          const subtotal = order.subtotal;
          const taxAmount = order.taxAmount || 0;
          const newTotal = subtotal + taxAmount - discountAmount;
          (updateData as any).total_price = Math.max(0, newTotal);
        }
      }

      if (status === "rejected") {
        (updateData as any).rejection_reason = rejectionReason || null;
        (updateData as any).rejection_comment = rejectionComment || null;
        (updateData as any).discount_amount = 0;
      } else {
        (updateData as any).rejection_reason = null;
        (updateData as any).rejection_comment = null;
      }

      const { data, error } = await (supabase.from("orders") as any)
        .update(updateData)
        .eq("id", orderId)
        .select()
        .single();

      if (error) throw error;

      await loadOrders();
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    },
    [loadOrders, getOrderById, queryClient],
  );

  const deleteOrder = useCallback(
    async (orderId: string): Promise<void> => {
      const { data: deleted, error } = await (supabase as any).rpc(
        "delete_order_and_restore_inventory",
        { p_order_id: orderId },
      );

      if (error) {
        throw new Error(error.message || "Failed to delete order");
      }
      if (!deleted) {
        throw new Error("Order was already deleted.");
      }

      await loadOrders();
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
    [loadOrders, queryClient],
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
      const order = getOrderById(orderId);
      if (!order) throw new Error("Order not found");

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

      const { error } = await (supabase.from("orders") as any).update(updateData).eq("id", orderId);

      if (error) throw error;

      await loadOrders();
    },
    [loadOrders, getOrderById],
  );

  const confirmInvoice = useCallback(
    async (orderId: string): Promise<void> => {
      const updateData: OrderUpdate = {
        invoice_confirmed: true,
        invoice_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase.from("orders") as any).update(updateData).eq("id", orderId);

      if (error) throw error;

      await loadOrders();
    },
    [loadOrders],
  );

  const downloadInvoicePDF = useCallback(
    async (orderId: string): Promise<void> => {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(ORDER_FIELDS)
        .eq("id", orderId)
        .single();

      if (orderError || !orderData) throw new Error("Order not found");

      const order = dbRowToOrder(orderData);

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

  const contextValue = useMemo(
    () => ({
      orders,
      createOrder,
      createManualOrder,
      updateManualOrder,
      patchManualSaleOrderDetails,
      updateOrderStatus,
      deleteOrder,
      updateInvoice,
      confirmInvoice,
      downloadInvoicePDF,
      getUserOrders,
      getAllOrders,
      getOrderById,
      refreshOrders: loadOrders,
      isLoading,
    }),
    [
      orders,
      isLoading,
      createOrder,
      createManualOrder,
      updateManualOrder,
      patchManualSaleOrderDetails,
      updateOrderStatus,
      deleteOrder,
      updateInvoice,
      confirmInvoice,
      downloadInvoicePDF,
      getUserOrders,
      getAllOrders,
      getOrderById,
      loadOrders,
    ],
  );

  return <OrdersContext.Provider value={contextValue}>{children}</OrdersContext.Provider>;
};
