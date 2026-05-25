"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { FilterValues, defaultFilters, buildServerFilters } from "@/components/common/FilterBar";
import { ColourRow } from "@/components/modals/ColourBreakdownDialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";
import { InventoryItem, calculatePricePerUnit } from "@/data/inventory";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { useDebounce } from "@/hooks/common/use-debounce";
import { useFilterOptions } from "@/hooks/use-filter-options";
import { usePageParam } from "@/hooks/common/use-page-param";
import { filterInventoryItems, sortInventoryItems } from "@/lib/inventory/group-inventory-items";
import {
  fetchInventoryColorsQuery,
  deleteInventoryColorsByInventoryIdsQuery,
  upsertInventoryColorsQuery,
  checkOrderProductReferencesQuery,
  deleteInventoryItemsQuery,
} from "@/lib/supabase/queries";
import { toastError } from "@/lib/utils/toast-helpers";

const PRODUCTS_PAGE_SIZE = 20;

export function useProductManagement() {
  const {
    inventory,
    groupedInventory,
    updateProduct,
    resetInventory,
    refreshInventory,
    isLoading,
  } = useInventory();
  const { isOwner, isManager, companyId } = useCompany();

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
  const serverFilters = useMemo(
    () => buildServerFilters(debouncedSearch, filters),
    [debouncedSearch, filters],
  );
  const filtersKey = useMemo(() => JSON.stringify(serverFilters), [serverFilters]);
  const [currentPage, setCurrentPage] = usePageParam();

  // Client-side filter + sort on grouped inventory (show all items including inactive).
  const filteredSorted = useMemo(() => {
    const filtered = filterInventoryItems(groupedInventory, serverFilters);
    return sortInventoryItems(filtered, serverFilters.sortBy ?? "created_asc");
  }, [groupedInventory, serverFilters]);

  const totalCount = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PRODUCTS_PAGE_SIZE));
  const filteredItems = useMemo(
    () =>
      filteredSorted.slice(
        (currentPage - 1) * PRODUCTS_PAGE_SIZE,
        currentPage * PRODUCTS_PAGE_SIZE,
      ),
    [filteredSorted, currentPage],
  );
  const rangeFrom = totalCount > 0 ? (currentPage - 1) * PRODUCTS_PAGE_SIZE + 1 : 0;
  const rangeTo = Math.min(currentPage * PRODUCTS_PAGE_SIZE, totalCount);
  const rangeText = totalCount > 0 ? `${rangeFrom}-${rangeTo} of ${totalCount}` : "0 items";

  // Reset to page 1 when filters change.
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  // Clamp page when results shrink.
  useEffect(() => {
    if (currentPage > totalPages && !isLoading) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, isLoading, setCurrentPage]);

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

      // For grouped items, aggregate colors across ALL underlying inventory rows.
      const product = filteredItems.find((p) => p.id === productId);
      const ids = product?.inventoryIds ?? [productId];

      try {
        const data = await fetchInventoryColorsQuery(ids);

        // Sum quantities per color across all rows in the group.
        const totals = new Map<string, number>();
        for (const c of (data ?? []) as { color: string; quantity: number }[]) {
          totals.set(c.color, (totals.get(c.color) ?? 0) + c.quantity);
        }
        const rows: ColourRow[] = Array.from(totals.entries())
          .filter(([, qty]) => qty > 0)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([color, quantity]) => ({ color, quantity: String(quantity) }));

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
    [loadedColors, filteredItems],
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

    const ids = product.inventoryIds ?? [product.id];

    try {
      if (ids.length <= 1) {
        // Single-row item — update normally.
        const qty = (fieldUpdates.quantity ?? product.quantity) as number;
        const pp = (fieldUpdates.purchasePrice ?? product.purchasePrice ?? 0) as number;
        const h = (fieldUpdates.hst ?? product.hst ?? 0) as number;
        fieldUpdates.pricePerUnit = calculatePricePerUnit(pp, qty, h);
        await updateProduct(id, fieldUpdates);
      } else {
        // Grouped item — apply spec/price changes to every underlying raw row.
        const rawRows = inventory.filter((i) => ids.includes(i.id));
        const totalNewPP =
          fieldUpdates.purchasePrice !== undefined
            ? (fieldUpdates.purchasePrice as number)
            : (product.purchasePrice ?? 0);
        const totalOldPP = product.purchasePrice ?? 0;

        for (const rawRow of rawRows) {
          // Don't allow direct quantity editing on grouped rows; keep each row's qty.
          const { quantity: _ignored, ...sharedUpdates } = fieldUpdates;
          const rowUpdates: Partial<InventoryItem> = { ...sharedUpdates };

          // Distribute purchase price proportionally across underlying rows.
          if (fieldUpdates.purchasePrice !== undefined) {
            const rowRatio =
              totalOldPP > 0 ? (rawRow.purchasePrice ?? 0) / totalOldPP : 1 / ids.length;
            rowUpdates.purchasePrice = Math.round(totalNewPP * rowRatio * 100) / 100;
          }

          const pp = (rowUpdates.purchasePrice ?? rawRow.purchasePrice ?? 0) as number;
          const h = (rowUpdates.hst ?? rawRow.hst ?? 0) as number;
          rowUpdates.pricePerUnit = calculatePricePerUnit(pp, rawRow.quantity, h);
          await updateProduct(rawRow.id, rowUpdates);
        }
      }

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

    // For grouped items, collect all underlying row IDs.
    const product = filteredItems.find((p) => p.id === id);
    const allIds = product?.inventoryIds ?? [id];

    setColourDialog((prev) => ({ ...prev, isSaving: true }));
    try {
      // Clear color rows from every underlying DB row so we start fresh.
      await deleteInventoryColorsByInventoryIdsQuery(allIds);

      const validRows = rows
        .filter((r) => r.color.trim() && Number(r.quantity) > 0)
        .map((r) => ({
          inventory_id: id, // consolidate the aggregate onto the representative row
          color: r.color.trim(),
          quantity: Number(r.quantity),
          updated_at: new Date().toISOString(),
        }));

      if (validRows.length > 0) {
        await upsertInventoryColorsQuery(validRows);
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
        const count = await checkOrderProductReferencesQuery(companyId, product.id);
        setDeleteDialog((prev) => ({ ...prev, orderCount: count, isChecking: false }));
      } catch {
        setDeleteDialog((prev) => ({ ...prev, orderCount: 0, isChecking: false }));
      }
    },
    [companyId],
  );

  const handleDeleteConfirm = useCallback(async () => {
    const product = deleteDialog.product;
    if (!product) return;

    const ids = product.inventoryIds ?? [product.id];

    setDeleteDialog((prev) => ({ ...prev, isDeleting: true }));
    try {
      await deleteInventoryItemsQuery(ids, companyId);

      await refreshInventory();
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
      setEditedProducts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete product. Please try again.",
      );
      setDeleteDialog((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteDialog.product, companyId, refreshInventory]);

  const canDelete = isOwner || isManager;

  const hasChanges = Object.keys(editedProducts).length > 0;
  const shouldShowSkeleton = isLoading && filteredItems.length === 0;

  // The product whose colour dialog is open (for passing to the dialog)
  const colourDialogProduct = colourDialog.productId
    ? filteredItems.find((p) => p.id === colourDialog.productId)
    : null;

  return {
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
  };
}
