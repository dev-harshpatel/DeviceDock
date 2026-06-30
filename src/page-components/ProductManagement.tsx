"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/common/FilterBar";
import { PaginationControls } from "@/components/common/PaginationControls";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { ColourBreakdownDialog } from "@/components/modals/ColourBreakdownDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ProductImeiDeleter } from "@/components/products/ProductImeiDeleter";
import { ProductImeiEditor } from "@/components/products/ProductImeiEditor";
import { ProductTableRow } from "@/components/products/ProductTableRow";
import { ProductDeleteDialog } from "@/components/products/ProductDeleteDialog";
import { useProductManagement } from "@/hooks/use-product-management";

export default function ProductManagement() {
  const {
    // states
    activeView,
    setActiveView,
    filters,
    setFilters,
    filterOptions,
    currentPage,
    setCurrentPage,
    editedProducts,
    pendingToggles,
    togglingProducts,
    colourDialog,
    setColourDialog,
    loadedColors,
    editedColors,
    loadingColors,
    deleteDialog,
    setDeleteDialog,

    // pagination & summary data
    totalCount,
    totalPages,
    filteredItems,
    rangeText,
    canDelete,
    hasChanges,
    shouldShowSkeleton,
    colourDialogProduct,

    // handlers
    handleFieldChange,
    openColourDialog,
    closeColourDialog,
    handleSave,
    handleColourDialogConfirm,
    handleReset,
    handleToggleActive,
    handleResetFilters,
    handleDeleteClick,
    handleDeleteConfirm,
  } = useProductManagement();

  return (
    <Tabs
      value={activeView}
      onValueChange={setActiveView}
      className="flex flex-col flex-1 min-h-0 h-full"
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background pb-3 space-y-3 border-b border-border mb-3 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-3 lg:pt-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Edit Products
              <span className="text-muted-foreground font-normal text-sm ml-2">
                {totalCount} products
              </span>
            </h2>
            <TabsList className="w-fit">
              <TabsTrigger value="summary">Product Summary</TabsTrigger>
              <TabsTrigger value="imei">Edit by IMEI</TabsTrigger>
              <TabsTrigger value="delete-imei">Delete by IMEI</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex gap-2 shrink-0">
            {activeView === "summary" && hasChanges && (
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset All
              </Button>
            )}
          </div>
        </div>
        {activeView === "summary" && (
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            onReset={handleResetFilters}
            brands={filterOptions.brands}
            storageOptions={filterOptions.storageOptions}
          />
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-4 lg:-mx-6 px-4 lg:px-6">
        <TabsContent value="summary" className="mt-0 space-y-0">
          {shouldShowSkeleton && (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-muted">
                    {[
                      "Device Name",
                      "Brand",
                      "Grade",
                      "Storage",
                      "Quantity",
                      "Purchase Price",
                      "HST %",
                      "Price/Unit",
                      "Selling Price",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <tr
                      key={index}
                      className={cn("animate-pulse", index % 2 === 1 && "bg-muted/20")}
                    >
                      {[240, 140, 120, 100, 96, 112, 80, 96, 112, 96].map((w, ci) => (
                        <td key={ci} className="px-3 py-2">
                          <div
                            className={cn("h-9 rounded-md bg-muted", ci === 0 ? "" : "mx-auto")}
                            style={{ width: w }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!shouldShowSkeleton && filteredItems.length > 0 && (
            <div className="relative rounded-lg border border-border bg-card overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                      Device Name
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                      Brand
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                      Grade
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                      Storage
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                      Quantity
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                      Purchase Price
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                      HST %
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                      Price/Unit
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                      Selling Price
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((product, index) => {
                    const isColorLoading = loadingColors.has(product.id);
                    const hasColours = (loadedColors[product.id]?.length ?? 0) > 0;
                    const isActive = pendingToggles[product.id] ?? product.isActive ?? true;
                    const isToggling = togglingProducts.has(product.id);

                    return (
                      <ProductTableRow
                        key={product.id}
                        product={product}
                        index={index}
                        editedFields={editedProducts[product.id]}
                        isColorLoading={isColorLoading}
                        hasColours={hasColours}
                        isActive={isActive}
                        isToggling={isToggling}
                        canDelete={canDelete}
                        onFieldChange={handleFieldChange}
                        onOpenColour={openColourDialog}
                        onSave={handleSave}
                        onToggleActive={handleToggleActive}
                        onDelete={handleDeleteClick}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!shouldShowSkeleton && filteredItems.length === 0 && (
            <EmptyState
              title="No products found"
              description="Try adjusting your search or filter criteria to find what you're looking for."
            />
          )}
        </TabsContent>

        <TabsContent value="imei" className="mt-0">
          <ProductImeiEditor onSaveSuccess={() => setActiveView("summary")} />
        </TabsContent>

        <TabsContent value="delete-imei" className="mt-0">
          <ProductImeiDeleter />
        </TabsContent>
      </div>

      {/* Pagination — pinned to the bottom, cancels main's padding so it's flush */}
      {activeView === "summary" && filteredItems.length > 0 && (
        // add little padding to the bottom of the pagination controls
        <div className="flex-shrink-0 bg-background border-t border-border -mx-4 lg:-mx-6 -mb-4 lg:-mb-6 px-4 lg:px-6 pt-1.5 pb-3 lg:pb-4 [&_button]:h-8 [&_button]:min-w-8 [&_button]:text-xs [&_button]:px-2 lg:[&_button]:h-9 lg:[&_button]:min-w-9 lg:[&_button]:text-sm lg:[&_button]:px-3">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            rangeText={rangeText}
          />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ProductDeleteDialog
        open={deleteDialog.open}
        product={deleteDialog.product}
        orderCount={deleteDialog.orderCount}
        isChecking={deleteDialog.isChecking}
        isDeleting={deleteDialog.isDeleting}
        onOpenChange={(open) => {
          if (!open && !deleteDialog.isDeleting) {
            setDeleteDialog({
              open: false,
              product: null,
              orderCount: null,
              isChecking: false,
              isDeleting: false,
            });
          }
        }}
        onConfirm={handleDeleteConfirm}
      />

      {/* Colour breakdown dialog */}
      <ColourBreakdownDialog
        open={colourDialog.open}
        onOpenChange={(open) => {
          if (!open) closeColourDialog();
        }}
        productName={colourDialogProduct?.deviceName ?? ""}
        totalQuantity={
          colourDialog.productId
            ? (((editedProducts[colourDialog.productId]?.quantity ??
                colourDialogProduct?.quantity) as number) ?? 0)
            : 0
        }
        initialColors={colourDialog.productId ? (editedColors[colourDialog.productId] ?? []) : []}
        onConfirm={handleColourDialogConfirm}
        isSaving={colourDialog.isSaving}
        confirmLabel="Save Colours"
      />
    </Tabs>
  );
}
