"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useOrders } from "@/contexts/OrdersContext";
import { useCompany } from "@/contexts/CompanyContext";
import { fetchOrderById, fetchCompanySettings } from "@/lib/supabase/queries";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/components/ui/sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateInvoiceNumber, generatePONumber, calculateDueDate } from "@/lib/invoice/utils";
import { getUserProfile } from "@/lib/supabase/utils";
import { useCompanyRoute } from "@/hooks/useCompanyRoute";
import { invoiceSchema, type InvoiceFormData } from "@/types/invoice";

const DEFAULT_TERMS_AND_CONDITIONS = `Terms & Conditions:
• Please inspect all items carefully upon delivery.
• All exchanges must be made within 15 days of purchase.
• Products must be returned in their original packaging.
• 45-day warranty from the date of purchase (physical and water damage not covered).
• Returned items must be in new, original condition as received.
• If an item is tampered with, the return will be rejected.
• Buyer is responsible for return shipping costs for any reason.
• All approved returns take 1–2 weeks to process.`;

export function useInvoiceManagement() {
  const params = useParams();
  const router = useRouter();
  const { companyRoute } = useCompanyRoute();
  const orderId = params.orderId as string;
  const { updateInvoice, downloadInvoicePDF } = useOrders();
  const { canWrite: isAdmin, companyId } = useCompany();
  const queryClient = useQueryClient();
  const [companyHstNumber, setCompanyHstNumber] = useState("");

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: queryKeys.orderDetail(orderId),
    queryFn: () => fetchOrderById(orderId, companyId),
    enabled: !!orderId && !!companyId,
    staleTime: 30_000,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imeiNumbers, setImeiNumbers] = useState<Record<string, string>>({});
  const [customerInfo, setCustomerInfo] = useState<{
    businessName?: string | null;
    businessAddress?: string | null;
  } | null>(null);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoiceNumber: "",
      invoiceDate: "",
      poNumber: "",
      paymentTerms: "CHQ",
      dueDate: "",
      hstNumber: "",
      invoiceNotes: "",
      invoiceTerms: DEFAULT_TERMS_AND_CONDITIONS,
      discountType: "cad",
      discountAmount: "0",
      shippingAmount: "0",
    },
  });

  // Redirect if not admin
  useEffect(() => {
    if (isAdmin === false) {
      router.push(companyRoute("/orders"));
    }
  }, [isAdmin, router, companyRoute]);

  // Load customer info and initialize form when order data arrives
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const currentOrder = order;

        if (!currentOrder) {
          if (mounted) {
            toast.error("The order you are looking for does not exist.");
            router.push(companyRoute("/orders"));
          }
          return;
        }

        if (!mounted) return;

        const settingsRow = await fetchCompanySettings(companyId);
        if (!mounted) return;
        const fetchedHstNumber: string = settingsRow?.hst_number || "";
        setCompanyHstNumber(fetchedHstNumber);

        // Initialize IMEI numbers: prefer saved invoice data, fall back to identifier labels from order items
        const initialImei: Record<string, string> = { ...(currentOrder.imeiNumbers ?? {}) };
        currentOrder.items.forEach((item, index) => {
          const key = String(index);
          if (!initialImei[key] && item.identifierLabel) {
            initialImei[key] = item.identifierLabel;
          }
        });
        setImeiNumbers(initialImei);

        // Load customer info — for manual sales use the stored customer data
        if (currentOrder.isManualSale) {
          setCustomerInfo({
            businessName: currentOrder.manualCustomerName || "Walk-in Customer",
            businessAddress:
              [currentOrder.manualCustomerEmail, currentOrder.manualCustomerPhone]
                .filter(Boolean)
                .join(" | ") || null,
          });
        } else {
          const customerProfile = await getUserProfile(currentOrder.userId);
          if (!mounted) return;
          setCustomerInfo({
            businessName: customerProfile?.businessName || null,
            businessAddress: customerProfile?.businessAddress || null,
          });
        }

        // Pre-fill form with existing invoice data or defaults
        const orderDate = new Date(currentOrder.createdAt);
        const invoiceDate = currentOrder.invoiceDate || currentOrder.createdAt.split("T")[0];
        const paymentTerms = currentOrder.paymentTerms || "CHQ";
        const dueDate = currentOrder.dueDate || calculateDueDate(invoiceDate, paymentTerms);

        if (currentOrder.invoiceNumber) {
          const storedDiscountType = currentOrder.discountType || "cad";
          let discountAmountValue = "0";
          let discountTypeValue = storedDiscountType;

          if (currentOrder.discountAmount && currentOrder.discountAmount > 0) {
            if (storedDiscountType === "percentage") {
              const percentage = (currentOrder.discountAmount / currentOrder.subtotal) * 100;
              discountAmountValue = percentage.toFixed(2);
              discountTypeValue = "percentage";
            } else {
              discountAmountValue = currentOrder.discountAmount.toString();
              discountTypeValue = "cad";
            }
          }

          form.reset({
            invoiceNumber: currentOrder.invoiceNumber,
            invoiceDate: invoiceDate,
            poNumber: currentOrder.poNumber || "",
            paymentTerms: paymentTerms,
            dueDate: dueDate,
            hstNumber: currentOrder.hstNumber || fetchedHstNumber,
            invoiceNotes: currentOrder.invoiceNotes || "",
            invoiceTerms: currentOrder.invoiceTerms || DEFAULT_TERMS_AND_CONDITIONS,
            discountType: discountTypeValue,
            discountAmount: discountAmountValue,
            shippingAmount: currentOrder.shippingAmount
              ? currentOrder.shippingAmount.toString()
              : "0",
          });
        } else {
          // New invoice - generate invoice number and PO
          const invoiceNumber = await generateInvoiceNumber(orderDate);
          const poNumber = await generatePONumber(orderDate);
          if (!mounted) return;

          form.reset({
            invoiceNumber,
            invoiceDate: invoiceDate,
            poNumber,
            paymentTerms: paymentTerms,
            dueDate: dueDate,
            hstNumber: fetchedHstNumber,
            invoiceNotes: "",
            invoiceTerms: DEFAULT_TERMS_AND_CONDITIONS,
            discountType: "cad",
            discountAmount: currentOrder.discountAmount
              ? currentOrder.discountAmount.toString()
              : "0",
            shippingAmount: currentOrder.shippingAmount
              ? currentOrder.shippingAmount.toString()
              : "0",
          });
        }
      } catch (error) {
        if (mounted) toast.error("Failed to load order data.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    if (orderId && !orderLoading) {
      loadData();
    }

    return () => {
      mounted = false;
    };
  }, [orderId, orderLoading, order, companyId, companyRoute, router, form]);

  // Update due date when payment terms or invoice date changes
  const paymentTerms = form.watch("paymentTerms");
  const invoiceDate = form.watch("invoiceDate");

  useEffect(() => {
    if (invoiceDate && paymentTerms) {
      const calculatedDueDate = calculateDueDate(invoiceDate, paymentTerms);
      form.setValue("dueDate", calculatedDueDate);
    }
  }, [paymentTerms, invoiceDate, form]);

  const handleSave = async (data: InvoiceFormData) => {
    if (!order) return;

    setIsSaving(true);
    try {
      const discountType = data.discountType || "cad";
      const discountValue = parseFloat(data.discountAmount || "0") || 0;
      const shippingAmount = parseFloat(data.shippingAmount || "0") || 0;

      // Calculate final discount amount in CAD
      let finalDiscountAmount = 0;
      if (discountValue > 0) {
        if (discountType === "percentage") {
          finalDiscountAmount = (order.subtotal * discountValue) / 100;
        } else {
          finalDiscountAmount = discountValue;
        }
      }

      await updateInvoice(order.id, {
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        poNumber: data.poNumber,
        paymentTerms: data.paymentTerms,
        dueDate: data.dueDate,
        hstNumber: data.hstNumber || "",
        invoiceNotes: data.invoiceNotes || null,
        invoiceTerms: data.invoiceTerms || null,
        discountAmount: finalDiscountAmount,
        discountType: discountType,
        shippingAmount: shippingAmount,
        imeiNumbers: imeiNumbers,
      });

      queryClient.setQueryData(queryKeys.orderDetail(orderId), {
        ...order,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        poNumber: data.poNumber,
        paymentTerms: data.paymentTerms,
        dueDate: data.dueDate,
        hstNumber: data.hstNumber || null,
        invoiceNotes: data.invoiceNotes || null,
        invoiceTerms: data.invoiceTerms || null,
        discountAmount: finalDiscountAmount,
        discountType: discountType as "percentage" | "cad",
        shippingAmount: shippingAmount,
        imeiNumbers: imeiNumbers,
      });

      form.reset({
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        poNumber: data.poNumber,
        paymentTerms: data.paymentTerms,
        dueDate: data.dueDate,
        hstNumber: data.hstNumber || companyHstNumber,
        invoiceNotes: data.invoiceNotes || "",
        invoiceTerms: data.invoiceTerms || "",
        discountType: (data.discountType || "cad") as "percentage" | "cad",
        discountAmount: data.discountAmount || "0",
        shippingAmount: data.shippingAmount || "0",
      });

      toast.success("Invoice has been saved successfully.");
    } catch (error) {
      console.error("Failed to save invoice:", error);
      toast.error("Failed to save invoice. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!order) return;

    setIsDownloading(true);
    try {
      await downloadInvoicePDF(order.id);
      toast.success("Invoice PDF has been downloaded.");
    } catch (error) {
      toast.error("Failed to download invoice. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    order,
    isLoading,
    isSaving,
    isDownloading,
    imeiNumbers,
    customerInfo,
    form,
    handleSave,
    handleDownload,
    isAdmin,
    companyRoute,
    router,
    orderId,
  };
}
