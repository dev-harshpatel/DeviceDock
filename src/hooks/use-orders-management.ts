"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Order, OrderStatus } from "@/types/order";
import { useDebounce } from "@/hooks/common/use-debounce";
import { usePaginatedReactQuery } from "@/hooks/common/use-paginated-react-query";
import { usePageParam } from "@/hooks/common/use-page-param";
import { queryKeys } from "@/lib/query-keys";
import {
  DeletedOrder,
  fetchOrderById,
  fetchPaginatedDeletedOrders,
  fetchPaginatedOrders,
  OrdersFilters,
} from "@/lib/supabase/queries";
import { useCompany } from "@/contexts/CompanyContext";

export function useOrdersManagement() {
  const router = useRouter();
  const [isPendingManualSale, startManualSaleTransition] = useTransition();
  const { companyId, slug } = useCompany();
  const [activeTab, setActiveTab] = useState<"orders" | "deleted">("orders");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useDebounce(searchQuery);

  const serverFilters: OrdersFilters = {
    search: debouncedSearch,
    status: statusFilter,
  };

  const [currentPage, setCurrentPage] = usePageParam();
  const queryKey = queryKeys.ordersPage(currentPage, serverFilters);

  const filtersKey = JSON.stringify(serverFilters);

  const {
    data: filteredOrders,
    totalCount,
    totalPages,
    isLoading,
    rangeText,
  } = usePaginatedReactQuery<Order>({
    queryKey,
    fetchFn: (range) => fetchPaginatedOrders(serverFilters, range, companyId),
    currentPage,
    setCurrentPage,
    filtersKey,
  });

  // Deleted orders — separate pagination, loaded when tab is active
  const [deletedPage, setDeletedPage] = useState(1);
  const deletedQueryKey = queryKeys.deletedOrdersPage(deletedPage);

  const {
    data: deletedOrders,
    totalCount: deletedTotal,
    totalPages: deletedTotalPages,
    isLoading: deletedLoading,
    rangeText: deletedRangeText,
  } = usePaginatedReactQuery<DeletedOrder>({
    queryKey: deletedQueryKey,
    fetchFn: (range) => fetchPaginatedDeletedOrders(range, companyId),
    currentPage: deletedPage,
    setCurrentPage: setDeletedPage,
    filtersKey: companyId,
  });

  // Stable comma-joined key of sorted user IDs on the current page.
  // Manual sales store customer info on the order itself, so they're excluded.
  const userIdsKey = useMemo(() => {
    return Array.from(
      new Set(filteredOrders.filter((order) => !order.isManualSale).map((order) => order.userId)),
    )
      .sort()
      .join(",");
  }, [filteredOrders]);

  // Fetch emails for the current page's user IDs.
  // staleTime: Infinity — email addresses don't change within a session.
  // Each unique set of user IDs gets its own cache entry, so navigating between
  // pages shows cached results instantly on revisit.
  const { data: userEmails = {} } = useQuery({
    queryKey: queryKeys.userEmails(userIdsKey),
    queryFn: async () => {
      const userIds = userIdsKey.split(",").filter(Boolean);
      const response = await fetch("/api/users/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      if (!response.ok) return {} as Record<string, string>;
      const json = await response.json();
      return (json.emails ?? {}) as Record<string, string>;
    },
    staleTime: Infinity,
    enabled: userIdsKey.length > 0,
  });

  // Fetch full order detail on demand when a row is clicked.
  // The summary list omits invoice/address/IMEI fields to reduce payload;
  // this query fetches only when a modal is actually opened.
  const { data: selectedOrderDetail = null } = useQuery({
    queryKey: selectedOrderId
      ? queryKeys.orderDetail(selectedOrderId)
      : ["order", "detail", "__none__"],
    queryFn: () => fetchOrderById(selectedOrderId!, companyId),
    enabled: selectedOrderId !== null && modalOpen,
    staleTime: 30 * 1000,
  });

  const handleViewOrder = useCallback((order: Order) => {
    setSelectedOrderId(order.id);
    setModalOpen(true);
  }, []);

  const handleResetFilter = () => {
    setStatusFilter("all");
    setSearchQuery("");
  };

  const hasActiveFilters = statusFilter !== "all" || searchQuery.trim() !== "";
  const orderRows = useMemo(
    () =>
      filteredOrders.map((order) => ({
        order,
        brands:
          Array.isArray(order.items) && order.items.length > 0
            ? Array.from(new Set(order.items.map((item) => item.item?.brand).filter(Boolean))).join(
                ", ",
              )
            : "N/A",
        customerLabel: order.isManualSale
          ? order.manualCustomerName || "Walk-in Customer"
          : userEmails[order.userId] || `${order.userId.slice(0, 8)}...`,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
      })),
    [filteredOrders, userEmails],
  );

  const deletedOrderRows = useMemo(
    () =>
      deletedOrders.map((order) => ({
        order,
        customerLabel: order.isManualSale
          ? order.manualCustomerName || "Walk-in Customer"
          : `${order.userId.slice(0, 8)}...`,
      })),
    [deletedOrders],
  );

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value as OrderStatus | "all");
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as "orders" | "deleted");
  }, []);

  const handleOpenManualSale = useCallback(() => {
    startManualSaleTransition(() => {
      router.push(`/${slug}/orders/manual-sale`);
    });
  }, [router, slug]);

  return {
    activeTab,
    selectedOrderId,
    modalOpen,
    setModalOpen,
    statusFilter,
    searchQuery,
    filteredOrders,
    totalCount,
    totalPages,
    isLoading,
    rangeText,
    deletedPage,
    setDeletedPage,
    deletedOrders,
    deletedTotal,
    deletedTotalPages,
    deletedLoading,
    deletedRangeText,
    selectedOrderDetail,
    handleViewOrder,
    handleResetFilter,
    hasActiveFilters,
    orderRows,
    deletedOrderRows,
    handleSearchChange,
    handleStatusFilterChange,
    handleTabChange,
    handleOpenManualSale,
    isPendingManualSale,
    setCurrentPage,
    currentPage,
  };
}
