"use client";

import { Button } from "@/components/ui/button";
import {
  FilterBar,
  FilterValues,
  defaultFilters,
  buildServerFilters,
} from "@/components/common/FilterBar";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/common/PaginationControls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventory } from "@/contexts/InventoryContext";
import { useDebounce } from "@/hooks/use-debounce";
import { usePaginatedReactQuery } from "@/hooks/use-paginated-react-query";
import { usePageParam } from "@/hooks/use-page-param";
import { queryKeys } from "@/lib/query-keys";
import { InventoryItem, calculatePricePerUnit, formatPrice } from "@/data/inventory";
import { fetchPaginatedInventory } from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";
import { useFilterOptions } from "@/hooks/use-filter-options";
import { cn } from "@/lib/utils";
import { Loader2, Palette, RotateCcw, Save } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ColourBreakdownDialog, type ColourRow } from "@/components/modals/ColourBreakdownDialog";
import { GRADES } from "@/lib/constants/grades";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { EmptyState } from "@/components/common/EmptyState";
import { Switch } from "@/components/ui/switch";

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

  const getFieldValue = (product: InventoryItem, field: keyof InventoryItem) => {
    if (editedProducts[product.id]?.[field] !== undefined) {
      return editedProducts[product.id][field];
    }
    return product[field];
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
      toast.error(err instanceof Error ? err.message : "Failed to save changes. Please try again.");
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
      toast.error(err instanceof Error ? err.message : "Failed to save colours. Please try again.");
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

  const hasChanges = Object.keys(editedProducts).length > 0;
  const shouldShowSkeleton = (isLoading || isFetching) && filteredItems.length === 0;

  // The product whose colour dialog is open (for passing to the dialog)
  const colourDialogProduct = colourDialog.productId
    ? filteredItems.find((p) => p.id === colourDialog.productId)
    : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background pb-3 space-y-3 border-b border-border mb-3 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-3 lg:pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Edit Products
            <span className="text-muted-foreground font-normal text-sm ml-2">
              {totalCount} products
            </span>
          </h2>
          <div className="flex gap-2 shrink-0">
            {hasChanges && (
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset All
              </Button>
            )}
          </div>
        </div>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
          brands={filterOptions.brands}
          storageOptions={filterOptions.storageOptions}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-4 lg:-mx-6 px-4 lg:px-6">
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
                  <tr key={index} className={cn("animate-pulse", index % 2 === 1 && "bg-muted/20")}>
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
                  const hasEdits = !!editedProducts[product.id];
                  const isColorLoading = loadingColors.has(product.id);
                  const hasColours = (loadedColors[product.id]?.length ?? 0) > 0;

                  const deviceName = getFieldValue(product, "deviceName") as string;
                  const brand = getFieldValue(product, "brand") as string;
                  const grade = getFieldValue(product, "grade") as string;
                  const storage = getFieldValue(product, "storage") as string;
                  const quantity = getFieldValue(product, "quantity") as number;
                  const purchasePrice = (getFieldValue(product, "purchasePrice") ?? 0) as number;
                  const hst = (getFieldValue(product, "hst") ?? 0) as number;
                  const sellingPrice = getFieldValue(product, "sellingPrice") as number;
                  const calculatedPricePerUnit = calculatePricePerUnit(
                    purchasePrice,
                    quantity,
                    hst,
                  );
                  const isActive = pendingToggles[product.id] ?? product.isActive ?? true;
                  const isToggling = togglingProducts.has(product.id);

                  return (
                    <>
                      {/* ── Main product row ───────────────────────────────── */}
                      <tr
                        key={product.id}
                        className={cn(
                          "transition-colors hover:bg-muted/50",
                          index % 2 === 1 && "bg-muted/20",
                          hasEdits && "bg-primary/5",
                          !isActive && "opacity-50",
                        )}
                      >
                        <td className="px-4 py-2">
                          <Input
                            value={deviceName}
                            onChange={(e) =>
                              handleFieldChange(product.id, "deviceName", e.target.value)
                            }
                            className="min-w-[200px] text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={brand}
                            onChange={(e) => handleFieldChange(product.id, "brand", e.target.value)}
                            className="min-w-[120px] text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={grade}
                            onValueChange={(v) => handleFieldChange(product.id, "grade", v)}
                          >
                            <SelectTrigger className="min-w-[140px] text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GRADES.map((g) => (
                                <SelectItem key={g} value={g}>
                                  {g}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={storage}
                            onChange={(e) =>
                              handleFieldChange(product.id, "storage", e.target.value)
                            }
                            className="min-w-[100px] text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            value={quantity ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleFieldChange(
                                product.id,
                                "quantity",
                                val === "" ? "" : parseInt(val) || 0,
                              );
                            }}
                            onBlur={() => {
                              if (!quantity && quantity !== 0)
                                handleFieldChange(product.id, "quantity", 0);
                            }}
                            className="w-24 text-center text-sm"
                            min="0"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-muted-foreground text-sm">$</span>
                            <Input
                              type="number"
                              value={purchasePrice ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleFieldChange(
                                  product.id,
                                  "purchasePrice",
                                  val === "" ? "" : parseFloat(val) || 0,
                                );
                              }}
                              onBlur={() => {
                                if (!purchasePrice && purchasePrice !== 0)
                                  handleFieldChange(product.id, "purchasePrice", 0);
                              }}
                              className="w-28 text-right text-sm"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="number"
                              value={hst ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleFieldChange(
                                  product.id,
                                  "hst",
                                  val === "" ? "" : parseFloat(val) || 0,
                                );
                              }}
                              onBlur={() => {
                                if (!hst && hst !== 0) handleFieldChange(product.id, "hst", 0);
                              }}
                              className="w-20 text-right text-sm"
                              min="0"
                              step="0.01"
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm text-muted-foreground font-medium">
                            {formatPrice(calculatedPricePerUnit).replace(/\s*CAD$/i, "")}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-muted-foreground">$</span>
                            <Input
                              type="number"
                              value={sellingPrice ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleFieldChange(
                                  product.id,
                                  "sellingPrice",
                                  val === "" ? "" : parseFloat(val) || 0,
                                );
                              }}
                              onBlur={() => {
                                if (!sellingPrice && sellingPrice !== 0)
                                  handleFieldChange(product.id, "sellingPrice", 0);
                              }}
                              className="w-28 text-right text-sm"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-2">
                            {/* Colours button — opens dialog */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openColourDialog(product.id)}
                              disabled={isColorLoading}
                              className={cn(
                                "h-8 w-8 p-0 relative",
                                hasColours
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                              title="Manage colours"
                            >
                              {isColorLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Palette className="h-3.5 w-3.5" />
                              )}
                            </Button>

                            {/* Save button */}
                            <Button
                              size="sm"
                              variant={hasEdits ? "default" : "ghost"}
                              onClick={() => handleSave(product.id)}
                              disabled={!hasEdits}
                              className={cn("gap-1.5", !hasEdits && "text-muted-foreground")}
                              title={hasEdits ? "Save changes" : "No changes to save"}
                            >
                              <Save className="h-3.5 w-3.5" />
                            </Button>

                            {/* Active toggle */}
                            <Switch
                              checked={isActive}
                              onCheckedChange={() => handleToggleActive(product)}
                              disabled={isToggling}
                              title={
                                isActive ? "Listed — click to unlist" : "Unlisted — click to list"
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    </>
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
      </div>

      {/* Pagination — pinned to the bottom, cancels main's padding so it's flush */}
      {filteredItems.length > 0 && (
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
    </div>
  );
}
