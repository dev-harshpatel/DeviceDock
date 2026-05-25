"use client";

import { Loader2, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceDetailsForm } from "@/components/invoice/InvoiceDetailsForm";
import { InvoiceOrderSidebar } from "@/components/invoice/InvoiceOrderSidebar";
import { useInvoiceManagement } from "@/hooks/use-invoice-management";

export default function Invoice() {
  const {
    order,
    isLoading,
    isSaving,
    isDownloading,
    imeiNumbers,
    customerInfo,
    form,
    handleSave,
    handleDownload,
    companyRoute,
    router,
  } = useInvoiceManagement();

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
