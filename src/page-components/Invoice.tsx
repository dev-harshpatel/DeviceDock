"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrders } from "@/contexts/OrdersContext";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatPrice } from "@/data/inventory";
import { GRADE_LABELS } from "@/lib/constants/grades";
import {
  generateInvoiceNumber,
  generatePONumber,
  calculateDueDate,
} from "@/lib/invoice/utils";
import { InvoiceConfirmationDialog } from "@/components/modals/InvoiceConfirmationDialog";
import { Loader2, ArrowLeft, Save, Download, CheckCircle2 } from "lucide-react";
import { getUserProfile } from "@/lib/supabase/utils";
import { useCompanyRoute } from "@/hooks/useCompanyRoute";

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  poNumber: z.string().min(1, "PO number is required"),
  paymentTerms: z.string().min(1, "Payment terms is required"),
  dueDate: z.string().min(1, "Due date is required"),
  hstNumber: z.string().optional(),
  invoiceNotes: z.string().optional(),
  invoiceTerms: z.string().optional(),
  discountType: z.enum(["percentage", "cad"]).optional(),
  discountAmount: z.string().optional(),
  shippingAmount: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

import { PAYMENT_METHODS } from "@/lib/constants";

const PAYMENT_TERMS = PAYMENT_METHODS;

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
  const {
    getOrderById,
    updateInvoice,
    confirmInvoice,
    downloadInvoicePDF,
    isLoading: ordersLoading,
  } = useOrders();
  const { canWrite: isAdmin } = useCompany();
  const [order, setOrder] =
    useState<ReturnType<typeof getOrderById>>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
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
      hstNumber: "797155074RT0001",
      invoiceNotes: "",
      invoiceTerms: DEFAULT_TERMS_AND_CONDITIONS,
      discountType: "cad",
      discountAmount: "0",
      shippingAmount: "0",
    },
  });

  // IMEI changed vs saved order (so Save is enabled when only IMEI is edited)
  const isImeiDirty = (() => {
    const saved = order?.imeiNumbers ?? {};
    const keys = new Set([...Object.keys(imeiNumbers), ...Object.keys(saved)]);
    for (const key of keys) {
      if ((imeiNumbers[key] ?? "").trim() !== (saved[key] ?? "").trim())
        return true;
    }
    return false;
  })();

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

        // Initialize IMEI numbers from saved order data
        if (currentOrder.imeiNumbers) {
          setImeiNumbers(currentOrder.imeiNumbers);
        }

        // Load customer info — for manual sales use the stored customer data
        if (currentOrder.isManualSale) {
          setCustomerInfo({
            businessName: currentOrder.manualCustomerName || "Walk-in Customer",
            businessAddress:
              [
                currentOrder.manualCustomerEmail,
                currentOrder.manualCustomerPhone,
              ]
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
        const invoiceDate =
          currentOrder.invoiceDate || currentOrder.createdAt.split("T")[0];
        const paymentTerms = currentOrder.paymentTerms || "CHQ";
        const dueDate =
          currentOrder.dueDate || calculateDueDate(invoiceDate, paymentTerms);

        if (currentOrder.invoiceNumber) {
          const storedDiscountType = currentOrder.discountType || "cad";
          let discountAmountValue = "0";
          let discountTypeValue = storedDiscountType;

          if (currentOrder.discountAmount && currentOrder.discountAmount > 0) {
            if (storedDiscountType === "percentage") {
              const percentage =
                (currentOrder.discountAmount / currentOrder.subtotal) * 100;
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
            hstNumber: currentOrder.hstNumber || "797155074RT0001",
            invoiceNotes: currentOrder.invoiceNotes || "",
            invoiceTerms:
              currentOrder.invoiceTerms || DEFAULT_TERMS_AND_CONDITIONS,
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
            hstNumber: "797155074RT0001",
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
        invoiceConfirmed: false,
        invoiceConfirmedAt: null,
      });

      form.reset({
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        poNumber: data.poNumber,
        paymentTerms: data.paymentTerms,
        dueDate: data.dueDate,
        hstNumber: data.hstNumber || "797155074RT0001",
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

  const handleConfirm = async () => {
    if (!order) return;
    if (order.invoiceConfirmed) {
      toast.success("Invoice is already confirmed.");
      setConfirmationDialogOpen(false);
      return;
    }

    try {
      await confirmInvoice(order.id);
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              invoiceConfirmed: true,
              invoiceConfirmedAt: new Date().toISOString(),
            }
          : prev
      );
      toast.success(
        "Invoice has been confirmed. Customer can now download it."
      );
      setConfirmationDialogOpen(false);
    } catch (error) {
      toast.error("Failed to confirm invoice. Please try again.");
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
        {/* Header */}
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
          {/* Invoice Form */}
          <div className="flex-1 md:overflow-y-auto md:min-h-0 space-y-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSave)}
                className="space-y-6"
              >
                <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    Invoice Details
                  </h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="invoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="invoiceDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="poNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PO Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paymentTerms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Terms</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment terms" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PAYMENT_TERMS.map((term) => (
                                <SelectItem key={term} value={term}>
                                  {term}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hstNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>HST Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g., 797155074RT0001"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="invoiceNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Additional notes for the invoice..."
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoiceTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Terms</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Terms and conditions..."
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label>Discount (Optional)</Label>
                    <div className="flex items-center gap-2">
                      <FormField
                        control={form.control}
                        name="discountType"
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || "cad"}
                            >
                              <FormControl>
                                <SelectTrigger className="w-[120px]">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="percentage">%</SelectItem>
                                <SelectItem value="cad">CAD</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="discountAmount"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                max={
                                  form.watch("discountType") === "percentage"
                                    ? "100"
                                    : undefined
                                }
                                placeholder="0.00"
                                onWheel={(e) => e.currentTarget.blur()}
                                {...field}
                                className="flex-1"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="shippingAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shipping Amount (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            onWheel={(e) => e.currentTarget.blur()}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 w-full">
                    <Button
                      type="submit"
                      disabled={
                        isSaving ||
                        (!!order.invoiceNumber &&
                          !form.formState.isDirty &&
                          !isImeiDirty)
                      }
                      className="flex-1"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Invoice
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        !order.invoiceNumber || !!order.invoiceConfirmed
                      }
                      onClick={() => setConfirmationDialogOpen(true)}
                      aria-label="Confirm invoice"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirm Invoice
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* Order Summary + Order Items */}
          <div className="md:w-72 lg:w-80 md:flex-shrink-0 md:min-h-0 md:overflow-y-auto space-y-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4 shrink-0">
              <h2 className="text-lg font-semibold text-foreground">
                Order Summary
              </h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium text-foreground">
                    {customerInfo?.businessName || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Date:</span>
                  <span className="font-medium text-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium text-foreground">
                    {Array.isArray(order.items) ? order.items.length : 0}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                {/* Subtotal */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium text-foreground">
                    {formatPrice(order.subtotal)}
                  </span>
                </div>
                {(() => {
                  const discountType = form.watch("discountType") || "cad";
                  const discountValue =
                    parseFloat(form.watch("discountAmount") || "0") || 0;
                  const shippingValue =
                    parseFloat(form.watch("shippingAmount") || "0") || 0;
                  const currentDiscount = order.discountAmount || 0;
                  const currentShipping = order.shippingAmount || 0;

                  let calculatedDiscount = 0;
                  if (discountValue > 0) {
                    if (discountType === "percentage") {
                      calculatedDiscount =
                        (order.subtotal * discountValue) / 100;
                    } else {
                      calculatedDiscount = discountValue;
                    }
                  }

                  const displayDiscount =
                    calculatedDiscount > 0
                      ? calculatedDiscount
                      : currentDiscount;
                  const displayShipping =
                    shippingValue > 0 ? shippingValue : currentShipping;

                  const result =
                    order.subtotal - displayDiscount + displayShipping;

                  const taxRate = order.taxRate || 0;
                  const calculatedTax = result * taxRate;
                  const currentTax = order.taxAmount || 0;
                  const displayTax =
                    (calculatedDiscount > 0 &&
                      calculatedDiscount !== currentDiscount) ||
                    (shippingValue > 0 && shippingValue !== currentShipping)
                      ? calculatedTax
                      : currentTax;

                  const calculatedTotal = result + displayTax;

                  return (
                    <>
                      {displayDiscount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Discount:
                          </span>
                          <span className="font-medium text-success">
                            -{formatPrice(displayDiscount)}
                            {discountValue > 0 &&
                              discountType === "percentage" && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({discountValue}%)
                                </span>
                              )}
                          </span>
                        </div>
                      )}
                      {displayShipping > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Shipping:
                          </span>
                          <span className="font-medium text-foreground">
                            {formatPrice(displayShipping)}
                          </span>
                        </div>
                      )}
                      {(displayDiscount > 0 || displayShipping > 0) && (
                        <div className="flex justify-between text-sm pt-1">
                          <span className="text-muted-foreground font-medium">
                            Result:
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatPrice(result)}
                          </span>
                        </div>
                      )}
                      {order.taxRate && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Tax ({(order.taxRate * 100).toFixed(2)}%):
                          </span>
                          <span className="font-medium text-foreground">
                            {formatPrice(displayTax)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="font-semibold text-foreground">
                          Total:
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {formatPrice(Math.max(0, calculatedTotal))}
                        </span>
                      </div>
                      {(calculatedDiscount > 0 &&
                        calculatedDiscount !== currentDiscount) ||
                      (shippingValue > 0 &&
                        shippingValue !== currentShipping) ? (
                        <p className="text-xs text-muted-foreground italic">
                          * Total will update after saving
                        </p>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4 shrink-0">
              <h2 className="text-lg font-semibold text-foreground">
                Order Items
              </h2>
              <div className="max-h-[320px] overflow-y-auto -mr-2 pr-2 space-y-0">
                {Array.isArray(order.items) && order.items.length > 0 ? (
                  order.items.map((orderItem, index) => {
                    if (!orderItem?.item) return null;
                    const itemKey = String(index);
                    return (
                      <div
                        key={index}
                        className="py-3 border-b border-border last:border-b-0 space-y-2"
                      >
                        <div className="flex justify-between text-sm">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-medium text-foreground truncate">
                              {orderItem.item.deviceName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {GRADE_LABELS[
                                orderItem.item.grade as keyof typeof GRADE_LABELS
                              ] ?? orderItem.item.grade}{" "}
                              • {orderItem.item.storage} • Qty:{" "}
                              {orderItem.quantity}
                            </p>
                          </div>
                          <p className="font-medium text-foreground text-sm shrink-0">
                            {formatPrice(
                              orderItem.item.pricePerUnit * orderItem.quantity
                            )}
                          </p>
                        </div>
                        <div className="mt-1">
                          <p className="text-xs text-muted-foreground mb-1.5">
                            IMEI
                            {orderItem.quantity > 1
                              ? ` — ${orderItem.quantity} units, comma-separated`
                              : ""}
                          </p>
                          {orderItem.quantity > 1 ? (
                            <>
                              <Textarea
                                placeholder={`Enter ${orderItem.quantity} IMEI numbers separated by commas`}
                                value={imeiNumbers[itemKey] ?? ""}
                                onChange={(e) =>
                                  setImeiNumbers((prev) => ({
                                    ...prev,
                                    [itemKey]: e.target.value,
                                  }))
                                }
                                className="text-xs min-h-[80px] resize-none border-border focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0"
                              />
                              {(() => {
                                const entered = (imeiNumbers[itemKey] ?? "")
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean).length;
                                return entered > 0 ? (
                                  <p
                                    className={`text-xs mt-1 ${
                                      entered === orderItem.quantity
                                        ? "text-green-600"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {entered}/{orderItem.quantity} IMEI numbers
                                    entered
                                  </p>
                                ) : null;
                              })()}
                            </>
                          ) : (
                            <Input
                              placeholder="Enter IMEI number"
                              value={imeiNumbers[itemKey] ?? ""}
                              onChange={(e) =>
                                setImeiNumbers((prev) => ({
                                  ...prev,
                                  [itemKey]: e.target.value,
                                }))
                              }
                              className="h-8 text-xs border-border focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No items</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <InvoiceConfirmationDialog
        open={confirmationDialogOpen}
        onOpenChange={setConfirmationDialogOpen}
        onConfirm={handleConfirm}
        order={order}
      />
    </div>
  );
}
