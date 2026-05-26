/* eslint-disable react-refresh/only-export-components */
"use client";

import { Order, OrderItem } from "@/types/order";
import { ReactNode, createContext, useContext, useMemo } from "react";
import { useOrdersActions } from "@/hooks/use-orders-actions";

interface OrdersContextType {
  orders: Order[];
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

export const OrdersProvider = ({ children }: OrdersProviderProps) => {
  const actions = useOrdersActions();

  const contextValue = useMemo(() => actions, [actions]);

  return <OrdersContext.Provider value={contextValue}>{children}</OrdersContext.Provider>;
};
