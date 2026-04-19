"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FilterBar,
  FilterValues,
  defaultFilters,
  buildServerFilters,
} from "@/components/common/FilterBar";
import { PaginationControls } from "@/components/common/PaginationControls";
import { useQueryClient } from "@tanstack/react-query";
import { useInventory } from "@/contexts/InventoryContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useDebounce } from "@/hooks/use-debounce";
import { usePaginatedReactQuery } from "@/hooks/use-paginated-react-query";
import { usePageParam } from "@/hooks/use-page-param";
import { queryKeys } from "@/lib/query-keys";
import { InventoryItem, calculatePricePerUnit } from "@/data/inventory";
import { fetchPaginatedInventory } from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";
import { useFilterOptions } from "@/hooks/use-filter-options";
import { cn } from "@/lib/utils";
import { Loader2, RotateCcw } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/utils/toast-helpers";
import { ColourBreakdownDialog, type ColourRow } from "@/components/modals/ColourBreakdownDialog";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { EmptyState } from "@/components/common/EmptyState";
import { ProductImeiEditor } from "@/components/products/ProductImeiEditor";
import { ProductTableRow } from "@/components/products/ProductTableRow";
import { ProductDeleteDialog } from "@/components/products/ProductDeleteDialog";

const TableLoadingOverlay = ({ label }: { label: string }) => (
  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-2 shadow-sm">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-foreground">{label}</p>
    </div>
  </div>
);

export default function ProductManagement() {
  const { updateProduct, resetInventory } = useInventory();
  const { isOwner, isManager, companyId } = useCompany();
  const queryClient = useQueryClient();

  // ── Product field edits ───────────────────────────────────────────────────
  const [editedProducts, setEditedProducts] = useState<Record<string, Partial<InventoryItem>>>({});
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({});
  const [togglingProducts, setTogglingProducts] = useState<Set<string>>(new Set());

  // ── Colour dialog state ───────────────────────────────────────────────────
  const [colourDialog, setColourDialog] = useState<{
    open: boolean;
    productId: string | null;
    isSaving: boolean;
  }>({ open: false, productId: null, isSaving: false });
  // loadedColors: colours as fetched from DB (used to detect unsaved changes)
  const [loadedColors, setLoadedColors] = useState<Record<string, ColourRow[]>>({});
  // editedColors: live colour rows per product (may differ from loadedColors)
  const [editedColors, setEditedColors] = useState<Record<string, ColourRow[]>>({});
  // loadingColors: products whose colour data is currently being fetched
  const [loadingColors, setLoadingColors] = useState<Set<string>>(new Set());

  // ── Filters & pagination ──────────────────────────────────────────────────
  const [activeView, setActiveView] = useState("summary");
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);
  const filterOptions = useFilterOptions();
  const debouncedSearch = useDebounce(filters.search);
  const serverFilters = buildServerFilters(debouncedSearch, filters);
  const [currentPage, setCurrentPage] = usePageParam();
  const queryKey = queryKeys.inventoryPage(currentPage, serverFilters);
  const filtersKey = JSON.stringify(serverFilters);

  const {
    data: filteredItems,
    totalCount,
    totalPages,
    isLoading,
    isFetching,
    rangeText,
  } = usePaginatedReactQuery<InventoryItem>({
    queryKey,
    fetchFn: (range) =>
      fetchPaginatedInventory(serverFilters, range, {
        showInactive: true,
        includeAdminFields: true,
      }),
    currentPage,
    setCurrentPage,
    filtersKey,
  });

  // ── Product field handlers ────────────────────────────────────────────────
  const handleFieldChange = (id: string, field: keyof InventoryItem, value: string | number) => {
    setEditedProducts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // ── Colour handlers ───────────────────────────────────────────────────────
  const fetchColorsForProduct = useCallback(
    async (productId: string) => {
      if (loadedColors[productId] !== undefined) return; // already loaded
      setLoadingColors((prev) => new Set(prev).add(productId));
      try {
        const { data } = await (supabase as any)
          .from("inventory_colors")
          .select("color, quantity")
          .eq("inventory_id", productId)
          .order("color");
        const rows: ColourRow[] = (data ?? []).map((c: { color: string; quantity: number }) => ({
          color: c.color,
          quantity: String(c.quantity),
        }));
        setLoadedColors((prev) => ({ ...prev, [productId]: rows }));
        setEditedColors((prev) => ({ ...prev, [productId]: rows }));
      } catch {
        setLoadedColors((prev) => ({ ...prev, [productId]: [] }));
        setEditedColors((prev) => ({ ...prev, [productId]: [] }));
      } finally {
        setLoadingColors((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [loadedColors],
  );

  const openColourDialog = async (productId: string) => {
    await fetchColorsForProduct(productId);
    setColourDialog({ open: true, productId, isSaving: false });
  };

  const closeColourDialog = () =>
    setColourDialog({ open: false, productId: null, isSaving: false });

  // ── Save product field changes ────────────────────────────────────────────
  const handleSave = async (id: string) => {
    const fieldUpdates = editedProducts[id];
    if (!fieldUpdates) return;

    const product = filteredItems.find((p) => p.id === id);
    if (!product) return;

    try {
      const qty = (fieldUpdates.quantity ?? product.quantity) as number;
      const pp = (fieldUpdates.purchasePrice ?? product.purchasePrice ?? 0) as number;
      const h = (fieldUpdates.hst ?? product.hst ?? 0) as number;
      fieldUpdates.pricePerUnit = calculatePricePerUnit(pp, qty, h);
      await updateProduct(id, fieldUpdates);
      setEditedProducts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success(TOAST_MESSAGES.PRODUCT_UPDATED, {
        description: "Changes have been saved to inventory.",
      });
    } catch (err) {
      toastError(err, "Failed to save changes. Please try again.");
    }
  };

  // ── Colour dialog confirm ─────────────────────────────────────────────────
  const handleColourDialogConfirm = async (rows: ColourRow[]) => {
    const id = colourDialog.productId;
    if (!id) return;

    setColourDialog((prev) => ({ ...prev, isSaving: true }));
    try {
      const validRows = rows
        .filter((r) => r.color.trim() && Number(r.quantity) > 0)
        .map((r) => ({
          inventory_id: id,
          color: r.color.trim(),
          quantity: Number(r.quantity),
          updated_at: new Date().toISOString(),
        }));

      if (validRows.length > 0) {
        const { error: upsertError } = await (supabase as any)
          .from("inventory_colors")
          .upsert(validRows, { onConflict: "inventory_id,color" });
        if (upsertError) throw upsertError;

        const keptColors = validRows.map((r) => r.color);
        const { data: existing } = await (supabase as any)
          .from("inventory_colors")
          .select("color")
          .eq("inventory_id", id);
        const toDelete = (existing ?? [])
          .map((r: { color: string }) => r.color)
          .filter((c: string) => !keptColors.includes(c));
        if (toDelete.length > 0) {
          await (supabase as any)
            .from("inventory_colors")
            .delete()
            .eq("inventory_id", id)
            .in("color", toDelete);
        }
      } else {
        // All rows cleared — delete everything for this item
        await (supabase as any).from("inventory_colors").delete().eq("inventory_id", id);
      }

      setLoadedColors((prev) => ({ ...prev, [id]: rows }));
      setEditedColors((prev) => ({ ...prev, [id]: rows }));
      toast.success("Colours saved", {
        description: "Colour breakdown has been updated.",
      });
      closeColourDialog();
    } catch (err) {
      toastError(err, "Failed to save colours. Please try again.");
      setColourDialog((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const handleReset = async () => {
    await resetInventory();
    setEditedProducts({});
    toast.success(TOAST_MESSAGES.INVENTORY_RESET, {
      description: "All products have been reset to original values.",
    });
  };

  const handleToggleActive = async (product: InventoryItem) => {
    const currentIsActive = pendingToggles[product.id] ?? product.isActive ?? true;
    const newIsActive = !currentIsActive;
    setPendingToggles((prev) => ({ ...prev, [product.id]: newIsActive }));
    setTogglingProducts((prev) => new Set(prev).add(product.id));
    try {
      await updateProduct(product.id, { isActive: newIsActive });
      toast.success(newIsActive ? "Product is now listed" : "Product has been unlisted", {
        description: newIsActive
          ? "Users can see and order this product."
          : "Users can no longer see or order this product.",
      });
    } catch {
      setPendingToggles((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      toast.error("Failed to update product listing status");
    } finally {
      setTogglingProducts((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleResetFilters = () => setFilters(defaultFilters);

  // ── Delete product ────────────────────────────────────────────────────────
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    product: InventoryItem | null;
    /** null = still checking, number = result */
    orderCount: number | null;
    isChecking: boolean;
    isDeleting: boolean;
  }>({ open: false, product: null, orderCount: null, isChecking: false, isDeleting: false });

  const handleDeleteClick = useCallback(
    async (product: InventoryItem) => {
      setDeleteDialog({
        open: true,
        product,
        orderCount: null,
        isChecking: true,
        isDeleting: false,
      });

      try {
        // Check if any orders reference this inventory item in their JSONB items array.
        const { count, error } = await (supabase as any)
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .filter("items", "cs", JSON.stringify([{ item: { id: product.id } }]));

        if (error) throw error;
        setDeleteDialog((prev) => ({ ...prev, orderCount: count ?? 0, isChecking: false }));
      } catch {
        setDeleteDialog((prev) => ({ ...prev, orderCount: 0, isChecking: false }));
      }
    },
    [companyId],
  );

  const handleDeleteConfirm = useCallback(async () => {
    const product = deleteDialog.product;
    if (!product) return;

    setDeleteDialog((prev) => ({ ...prev, isDeleting: true }));
    try {
      const { error } = await (supabase as any)
        .from("inventory")
        .delete()
        .eq("id", product.id)
        .eq("company_id", companyId);

      if (error) throw error;

      toast.success(`${product.deviceName} deleted`, {
        description: "Product and all associated records have been removed.",
      });
      setDeleteDialog({
        open: false,
        product: null,
        orderCount: null,
        isChecking: false,
        isDeleting: false,
      });
      // Remove any pending edits for this product
      setEditedProducts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      // Refetch the product list
      await queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete product. Please try again.",
      );
      setDeleteDialog((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteDialog.product, companyId, queryClient]);

  const canDelete = isOwner || isManager;

  const hasChanges = Object.keys(editedProducts).length > 0;
  const shouldShowSkeleton = (isLoading || isFetching) && filteredItems.length === 0;

  // The product whose colour dialog is open (for passing to the dialog)
  const colourDialogProduct = colourDialog.productId
    ? filteredItems.find((p) => p.id === colourDialog.productId)
    : null;

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
              {isFetching && <TableLoadingOverlay label="Searching products..." />}
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

          {!shouldShowSkeleton && !isFetching && filteredItems.length === 0 && (
            <EmptyState
              title="No products found"
              description="Try adjusting your search or filter criteria to find what you're looking for."
            />
          )}
        </TabsContent>

        <TabsContent value="imei" className="mt-0">
          <ProductImeiEditor />
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
