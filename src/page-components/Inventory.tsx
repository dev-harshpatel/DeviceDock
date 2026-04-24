"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AddProductChoiceModal } from "@/components/modals/AddProductChoiceModal";
import {
  FilterBar,
  FilterValues,
  defaultFilters,
  buildServerFilters,
} from "@/components/common/FilterBar";
import { ExportActions } from "@/components/common/ExportActions";
import { InventoryTable } from "@/components/tables/InventoryTable";
import { Loader } from "@/components/common/Loader";
import { PaginationControls } from "@/components/common/PaginationControls";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { usePageParam } from "@/hooks/use-page-param";
import { queryKeys } from "@/lib/query-keys";
import { filterInventoryItems, sortInventoryItems } from "@/lib/inventory/group-inventory-items";
import { useFilterOptions } from "@/hooks/use-filter-options";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";

const INVENTORY_PAGE_SIZE = 20;

const AddProductModal = dynamic(
  () =>
    import("@/components/modals/AddProductModal").then((mod) => ({
      default: mod.AddProductModal,
    })),
  { loading: () => null, ssr: false },
);

export default function Inventory() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);
  const [addProductChoiceOpen, setAddProductChoiceOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<"multiple" | "upload" | null>(null);
  const filterOptions = useFilterOptions();
  const queryClient = useQueryClient();
  const { companyName, slug } = useCompany();
  const { groupedInventory, isLoading, refreshInventory } = useInventory();

  const debouncedSearch = useDebounce(filters.search);

  const serverFilters = useMemo(
    () => buildServerFilters(debouncedSearch, filters),
    [debouncedSearch, filters],
  );

  const filtersKey = useMemo(() => JSON.stringify(serverFilters), [serverFilters]);

  const [currentPage, setCurrentPage] = usePageParam();

  // Apply filters and sort client-side on the grouped inventory (active items only).
  const filteredSorted = useMemo(() => {
    const active = groupedInventory.filter((item) => item.isActive !== false);
    const filtered = filterInventoryItems(active, serverFilters);
    return sortInventoryItems(filtered, serverFilters.sortBy ?? "created_asc");
  }, [groupedInventory, serverFilters]);

  // Client-side pagination derived values.
  const totalCount = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / INVENTORY_PAGE_SIZE));
  const data = useMemo(
    () =>
      filteredSorted.slice(
        (currentPage - 1) * INVENTORY_PAGE_SIZE,
        currentPage * INVENTORY_PAGE_SIZE,
      ),
    [filteredSorted, currentPage],
  );
  const rangeFrom = totalCount > 0 ? (currentPage - 1) * INVENTORY_PAGE_SIZE + 1 : 0;
  const rangeTo = Math.min(currentPage * INVENTORY_PAGE_SIZE, totalCount);
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

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const handleOpenAddProduct = useCallback(() => {
    setAddProductChoiceOpen(true);
  }, []);

  const handleOpenSingleProduct = useCallback(() => {
    setAddProductChoiceOpen(false);
    setAddProductOpen(true);
  }, []);

  const handleOpenMultipleProducts = useCallback(() => {
    setNavigatingTo("multiple");
    router.push(`/${slug}/add-multiple-products`);
  }, [router, slug]);

  const handleOpenUploadProducts = useCallback(() => {
    setNavigatingTo("upload");
    router.push(`/${slug}/upload-products`);
  }, [router, slug]);

  // Export returns all grouped+filtered rows (no pagination slice).
  const handleFetchAllData = useCallback(async () => {
    return filteredSorted;
  }, [filteredSorted]);

  const handleAddProductSuccess = useCallback(async () => {
    await refreshInventory();
    await queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
  }, [queryClient, refreshInventory]);

  const hasActiveFilters = useMemo(
    () =>
      serverFilters.search !== "" ||
      serverFilters.brand !== "all" ||
      serverFilters.grade !== "all" ||
      serverFilters.storage !== "all" ||
      serverFilters.priceRange !== "all" ||
      serverFilters.stockStatus !== "all" ||
      serverFilters.sortBy !== defaultFilters.sortBy,
    [serverFilters],
  );

  if (isLoading) {
    return <Loader size="lg" text="Loading inventory..." />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-10 bg-background pb-3 space-y-3 border-b border-border mb-3 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-3 lg:pt-4">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Inventory
            <span className="text-muted-foreground font-normal text-sm ml-2">
              {totalCount} devices
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleOpenAddProduct} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Product</span>
            </Button>
            <ExportActions
              onFetchAllData={handleFetchAllData}
              filename="inventory"
              companyName={companyName}
            />
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
          brands={filterOptions.brands}
          storageOptions={filterOptions.storageOptions}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden -mx-4 lg:-mx-6 px-4 lg:px-6">
        <InventoryTable
          items={data}
          className="h-full"
          showColorBreakdown
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Pagination - Sticky at bottom so it stays visible when scrolling on mobile */}
      <div className="flex-shrink-0 bg-background border-t border-border -mx-4 lg:-mx-6 -mb-4 lg:-mb-6 px-4 lg:px-6 py-2 [&_button]:h-8 [&_button]:min-w-8 [&_button]:text-xs [&_button]:px-2 lg:[&_button]:h-9 lg:[&_button]:min-w-9 lg:[&_button]:text-sm lg:[&_button]:px-3">
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          rangeText={rangeText}
        />
      </div>

      <AddProductModal
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
        onSuccess={handleAddProductSuccess}
      />
      <AddProductChoiceModal
        open={addProductChoiceOpen}
        onOpenChange={setAddProductChoiceOpen}
        onSelectSingle={handleOpenSingleProduct}
        onSelectMultiple={handleOpenMultipleProducts}
        onNavigateUpload={handleOpenUploadProducts}
        navigatingTo={navigatingTo}
      />
    </div>
  );
}
