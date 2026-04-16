"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrders } from "@/contexts/OrdersContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateInvoiceNumber, generatePONumber, calculateDueDate } from "@/lib/invoice/utils";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import { getUserProfile } from "@/lib/supabase/utils";
import { useCompanyRoute } from "@/hooks/useCompanyRoute";
import { invoiceSchema, type InvoiceFormData } from "@/types/invoice";
import { InvoiceDetailsForm } from "@/components/invoice/InvoiceDetailsForm";
import { InvoiceOrderSidebar } from "@/components/invoice/InvoiceOrderSidebar";

const DEFAULT_TERMS_AND_CONDITIONS = `Terms & Conditions:
• Please inspect all items carefully upon delivery.
• All exchanges must be made within 15 days of purchase.
• Products must be returned in their original packaging.
• 45-day warranty from the date of purchase (physical and water damage not covered).
• Returned items must be in new, original condition as received.
• If an item is tampered with, the return will be rejected.
• Buyer is responsible for return shipping costs for any reason.
• All approved returns take 1–2 weeks to process.`;

export default function Invoice() {
  const params = useParams();
  const router = useRouter();
  const { companyRoute } = useCompanyRoute();
  const orderId = params.orderId as string;
  const { getOrderById, updateInvoice, downloadInvoicePDF, isLoading: ordersLoading } = useOrders();
  const { canWrite: isAdmin, companyId } = useCompany();
  const [companyHstNumber, setCompanyHstNumber] = useState("");
  const [order, setOrder] = useState<ReturnType<typeof getOrderById>>(undefined);
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
  }, [isAdmin, router]);

  // Load order and customer info
  useEffect(() => {
    const loadData = async () => {
      // Wait for orders to finish loading first
      if (ordersLoading) {
        return;
      }

      setIsLoading(true);
      try {
        // Retry mechanism: wait for order to appear in context (handles race condition after approval)
        let currentOrder = getOrderById(orderId);
        let retries = 0;
        const maxRetries = 5;
        const retryDelay = 200; // 200ms between retries

        while (!currentOrder && retries < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          currentOrder = getOrderById(orderId);
          retries++;
        }

        if (!currentOrder) {
          toast.error("The order you are looking for does not exist.");
          router.push(companyRoute("/orders"));
          return;
        }

        setOrder(currentOrder);

        // Fetch company HST number from settings (single source of truth)
        const { data: settingsRow } = await (supabase as any)
          .from("company_settings")
          .select("hst_number")
          .eq("company_id", companyId)
          .maybeSingle();
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
        toast.error("Failed to load order data.");
      } finally {
        setIsLoading(false);
      }
    };

    if (orderId && !ordersLoading) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, ordersLoading]);

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

      setOrder({
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
    } catch (error: any) {
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

  if (isLoading || !order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-10 bg-background pb-4 space-y-4 border-b border-border mb-4 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-4 lg:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(companyRoute("/orders"))}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {order.invoiceNumber ? "Edit Invoice" : "Create Invoice"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Order #{order.id.slice(-8).toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={!order.invoiceNumber || isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-4 lg:-mx-6 px-4 lg:px-6 md:overflow-hidden">
        <div className="flex flex-col md:flex-row gap-6 md:h-full md:min-h-0">
          <div className="flex-1 md:overflow-y-auto md:min-h-0 space-y-6">
            <InvoiceDetailsForm
              form={form}
              isSaving={isSaving}
              hasInvoiceNumber={!!order.invoiceNumber}
              onSave={handleSave}
            />
          </div>

          <InvoiceOrderSidebar
            order={order}
            form={form}
            customerInfo={customerInfo}
            imeiNumbers={imeiNumbers}
          />
        </div>
      </div>
    </div>
  );
}
