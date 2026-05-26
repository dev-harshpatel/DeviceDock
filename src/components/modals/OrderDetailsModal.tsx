"use client";

import { ShoppingBag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Order } from "@/types/order";
import { OrderInfoSection } from "@/components/modals/OrderInfoSection";
import { OrderTotalSection } from "@/components/modals/OrderTotalSection";
import { useOrderDetails } from "@/hooks/use-order-details";
import { OrderItemsSection } from "@/components/modals/order-details/OrderItemsSection";
import { OrderProfitSection } from "@/components/modals/order-details/OrderProfitSection";
import { OrderDetailsActions } from "@/components/modals/order-details/OrderDetailsActions";
import { OrderDeleteConfirmDialog } from "@/components/modals/order-details/OrderDeleteConfirmDialog";

interface OrderDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

export const OrderDetailsModal = ({ open, onOpenChange, order }: OrderDetailsModalProps) => {
  const {
    // Action States
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
    isAdmin,
    handlePrefetchInvoice,

    // Handlers
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
    profitRows,
    totalRevenue,
    totalCost,
    totalProfit,
    totalMargin,
  } = useOrderDetails({ open, onOpenChange, order });

  if (!order) return null;

  const manualSaleBanner = order.isManualSale && (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-50 border border-orange-200 dark:bg-orange-950 dark:border-orange-800 text-sm text-orange-700 dark:text-orange-400">
      <ShoppingBag className="h-4 w-4 flex-shrink-0" />
      <span>This is a manually recorded sale — it was created directly by an admin.</span>
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

                <OrderItemsSection
                  order={order}
                  colorAssignments={colorAssignments}
                  fetchedIdentifierLabels={fetchedIdentifierLabels}
                  fetchedIdentifierColors={fetchedIdentifierColors}
                  fetchedIdentifierDamageNotes={fetchedIdentifierDamageNotes}
                  isAdmin={isAdmin}
                />

                <OrderTotalSection order={order} />
              </div>
            </TabsContent>

            {/* ── Profit tab ── */}
            <TabsContent
              value="profit"
              className="flex-1 min-h-0 mt-3 overflow-y-auto overflow-x-hidden pr-1 data-[state=active]:flex data-[state=active]:flex-col"
            >
              <OrderProfitSection
                profitRows={profitRows}
                totalRevenue={totalRevenue}
                totalCost={totalCost}
                totalProfit={totalProfit}
                totalMargin={totalMargin}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pb-3">
            {manualSaleBanner}
            <OrderInfoSection order={order} customerEmail={customerEmail} />

            <OrderItemsSection
              order={order}
              colorAssignments={colorAssignments}
              fetchedIdentifierLabels={fetchedIdentifierLabels}
              fetchedIdentifierColors={fetchedIdentifierColors}
              fetchedIdentifierDamageNotes={fetchedIdentifierDamageNotes}
              isAdmin={isAdmin}
            />

            <OrderTotalSection order={order} />
          </div>
        )}

        {/* ── Actions ── */}
        <OrderDetailsActions
          isAdmin={isAdmin}
          canCreateEditInvoice={canCreateEditInvoice}
          canDownloadInvoice={canDownloadInvoice}
          canEditManualSale={canEditManualSale}
          canDeleteOrder={canDeleteOrder}
          canReject={canReject}
          isRejecting={false}
          isDownloading={isDownloading}
          isDeleting={isDeleting}
          hasInvoice={hasInvoice}
          onOpenChange={onOpenChange}
          onDownloadInvoice={handleDownloadInvoice}
          onCreateEditInvoice={handleCreateEditInvoice}
          onPrefetchInvoice={handlePrefetchInvoice}
          onEditManualSale={handleEditManualSale}
          onDeleteClick={() => setDeleteDialogOpen(true)}
          onRejectClick={() => {}}
        />
      </DialogContent>

      {/* ── Delete confirmation ── */}
      <OrderDeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        isDeleting={isDeleting}
        onDelete={handleDeleteOrder}
      />
    </Dialog>
  );
};
