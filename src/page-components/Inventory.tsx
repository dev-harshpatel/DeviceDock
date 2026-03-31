"use client";

import { useCallback, useMemo, useState } from "react";
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
import { PaginationControls } from "@/components/common/PaginationControls";
import { AddProductModal } from "@/components/modals/AddProductModal";
import { Loader } from "@/components/common/Loader";
import { Button } from "@/components/ui/button";
import { InventoryItem } from "@/data/inventory";
import { useDebounce } from "@/hooks/use-debounce";
import { usePaginatedReactQuery } from "@/hooks/use-paginated-react-query";
import { usePageParam } from "@/hooks/use-page-param";
import { queryKeys } from "@/lib/query-keys";
import { fetchPaginatedInventory, fetchAllFilteredInventory } from "@/lib/supabase/queries";
import { useFilterOptions } from "@/hooks/use-filter-options";
import { useCompany } from "@/contexts/CompanyContext";

export default function Inventory() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);
  const [addProductChoiceOpen, setAddProductChoiceOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const filterOptions = useFilterOptions();
  const queryClient = useQueryClient();
  const { companyId, companyName, slug } = useCompany();

  const debouncedSearch = useDebounce(filters.search);

  const serverFilters = useMemo(
    () => buildServerFilters(debouncedSearch, filters),
    [debouncedSearch, filters],
  );

  const [currentPage, setCurrentPage] = usePageParam();
  const queryKey = useMemo(
    () => queryKeys.inventoryPage(currentPage, serverFilters),
    [currentPage, serverFilters],
  );

  const filtersKey = useMemo(() => JSON.stringify(serverFilters), [serverFilters]);

  const { data, totalCount, totalPages, isLoading, rangeText } =
    usePaginatedReactQuery<InventoryItem>({
      queryKey,
      fetchFn: (range) =>
        fetchPaginatedInventory(serverFilters, range, {
          includeAdminFields: true,
          companyId,
        }),
      currentPage,
      setCurrentPage,
      filtersKey,
    });

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
    setAddProductChoiceOpen(false);
    router.push(`/${slug}/add-multiple-products`);
  }, [router, slug]);

  const handleOpenUploadProducts = useCallback(() => {
    router.push(`/${slug}/upload-products`);
  }, [router, slug]);

  const handleFetchAllData = useCallback(async () => {
    return await fetchAllFilteredInventory(serverFilters, {
      includeAdminFields: true,
      companyId,
    });
  }, [companyId, serverFilters]);

  const handleAddProductSuccess = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
  }, [queryClient]);

  const hasActiveFilters = useMemo(
    () =>
      serverFilters.search !== "" ||
      serverFilters.brand !== "all" ||
      serverFilters.grade !== "all" ||
      serverFilters.storage !== "all" ||
      serverFilters.priceRange !== "all" ||
      serverFilters.stockStatus !== "all",
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
      />
    </div>
  );
}
