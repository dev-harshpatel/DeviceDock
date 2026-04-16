"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Order, OrderStatus } from "@/types/order";
import { ActiveOrderTableRow } from "@/components/orders/ActiveOrderTableRow";
import { DeletedOrderTableRow } from "@/components/orders/DeletedOrderTableRow";
import { OrdersHeader } from "@/components/orders/OrdersHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
// TODO: Remove if Request Device feature is not required in later development
// import { AdminWishDetailsModal } from "@/components/modals/AdminWishDetailsModal";
import { EmptyState } from "@/components/common/EmptyState";
import { PaginationControls } from "@/components/common/PaginationControls";
import { Loader } from "@/components/common/Loader";
import { useDebounce } from "@/hooks/use-debounce";
import { usePaginatedReactQuery } from "@/hooks/use-paginated-react-query";
import { usePageParam } from "@/hooks/use-page-param";
import { queryKeys } from "@/lib/query-keys";
import {
  DeletedOrder,
  fetchOrderById,
  fetchPaginatedDeletedOrders,
  fetchPaginatedOrders,
  OrdersFilters,
} from "@/lib/supabase/queries";
// TODO: Remove if Request Device feature is not required in later development
// import { fetchAllWishesForAdmin } from "@/lib/supabase/queries/wishes";
import { useCompany } from "@/contexts/CompanyContext";

const OrderDetailsModal = dynamic(
  () =>
    import("@/components/modals/OrderDetailsModal").then((mod) => ({
      default: mod.OrderDetailsModal,
    })),
  { loading: () => null, ssr: false },
);

export default function Orders() {
  const router = useRouter();
  const [isPendingManualSale, startManualSaleTransition] = useTransition();
  const { companyId, slug } = useCompany();
  const [activeTab, setActiveTab] = useState<"orders" | "deleted">("orders");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // TODO: Remove if Request Device feature is not required in later development
  // Pre-orders (wishes) state
  // const [wishes, setWishes] = useState<any[]>([]);
  // const [wishesLoading, setWishesLoading] = useState(false);
  // const [selectedWish, setSelectedWish] = useState<any | null>(null);
  // const [wishModalOpen, setWishModalOpen] = useState(false);
  // const [wishUserEmails, setWishUserEmails] = useState<Record<string, string>>({});

  // TODO: Remove if Request Device feature is not required in later development
  // const loadWishes = useCallback(async () => {
  //   setWishesLoading(true);
  //   try {
  //     const data = await fetchAllWishesForAdmin();
  //     setWishes(data);
  //
  //     // Fetch emails for all unique user IDs (same pattern as Orders)
  //     const uniqueUserIds = Array.from(new Set(data.map((w: any) => w.userId))).filter(Boolean);
  //     if (uniqueUserIds.length > 0) {
  //       const res = await fetch("/api/users/emails", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({ userIds: uniqueUserIds }),
  //       });
  //       if (res.ok) {
  //         const json = await res.json();
  //         setWishUserEmails(json.emails ?? {});
  //       }
  //     }
  //   } catch (err) {
  //     console.error("Failed to load pre-order requests:", err);
  //   } finally {
  //     setWishesLoading(false);
  //   }
  // }, []);

  // TODO: Remove if Request Device feature is not required in later development
  // Load wishes on mount so the badge count is visible immediately,
  // then reload whenever the tab is opened to get fresh data.
  // useEffect(() => {
  //   void loadWishes();
  // }, [loadWishes]);

  // useEffect(() => {
  //   if (activeTab === "preorders") {
  //     void loadWishes();
  //   }
  // }, [activeTab, loadWishes]);

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
    queryKey: queryKeys.orderDetail(selectedOrderId ?? ""),
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

  if (isLoading && activeTab === "orders") {
    return <Loader text="Loading orders..." />;
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full">
        <OrdersHeader
          activeTab={activeTab}
          totalCount={totalCount}
          deletedTotal={deletedTotal}
          hasActiveFilters={hasActiveFilters}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
          isPendingManualSale={isPendingManualSale}
          onSearchChange={handleSearchChange}
          onStatusFilterChange={handleStatusFilterChange}
          onOpenManualSale={handleOpenManualSale}
          onResetFilter={handleResetFilter}
        />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-4 lg:-mx-6 px-4 lg:px-6">
          <TabsContent value="orders" className="mt-0">
            {filteredOrders.length === 0 && !isLoading ? (
              <EmptyState
                title="No orders found"
                description="There are no orders matching your current filter criteria."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                          Order ID
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Customer
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Brand
                        </th>
                        <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Items
                        </th>
                        <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Total
                        </th>
                        <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Status
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Date
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Notes
                        </th>
                        <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orderRows.map(({ order, brands, customerLabel, itemCount }, index) => (
                        <ActiveOrderTableRow
                          key={order.id}
                          order={order}
                          brands={brands}
                          customerLabel={customerLabel}
                          itemCount={itemCount}
                          index={index}
                          onView={handleViewOrder}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TODO: Remove if Request Device feature is not required in later development */}
          {/* <TabsContent value="preorders" className="mt-0">...</TabsContent> */}

          <TabsContent value="deleted" className="mt-0">
            {deletedLoading ? (
              <Loader text="Loading deleted orders..." />
            ) : deletedOrders.length === 0 ? (
              <EmptyState
                title="No deleted orders"
                description="Orders that are deleted will appear here as an archive."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                          Order ID
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Customer
                        </th>
                        <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Total
                        </th>
                        <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Status at Deletion
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                          Order Date
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                          Deleted On
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {deletedOrderRows.map(({ order, customerLabel }, index) => (
                        <DeletedOrderTableRow
                          key={order.id}
                          order={order}
                          customerLabel={customerLabel}
                          index={index}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </div>

        {/* Pagination */}
        {activeTab === "orders" && filteredOrders.length > 0 && (
          <div className="flex-shrink-0 sticky bottom-0 z-10 bg-background border-t border-border -mx-4 lg:-mx-6 px-4 lg:px-6 py-2">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              rangeText={rangeText}
            />
          </div>
        )}
        {activeTab === "deleted" && deletedOrders.length > 0 && (
          <div className="flex-shrink-0 sticky bottom-0 z-10 bg-background border-t border-border -mx-4 lg:-mx-6 px-4 lg:px-6 py-2">
            <PaginationControls
              currentPage={deletedPage}
              totalPages={deletedTotalPages}
              onPageChange={setDeletedPage}
              rangeText={deletedRangeText}
            />
          </div>
        )}
      </Tabs>

      {modalOpen && (
        <OrderDetailsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          order={selectedOrderDetail}
        />
      )}

      {/* TODO: Remove if Request Device feature is not required in later development */}
      {/* <AdminWishDetailsModal
        open={wishModalOpen}
        onOpenChange={setWishModalOpen}
        wish={selectedWish}
        onUpdated={loadWishes}
      /> */}
    </>
  );
}

/* ─── TODO: Remove if Request Device feature is not required in later development ── */

// const WISH_STATUS_LABELS: Record<string, string> = {
//   pending: "Under Review",
//   offered: "Approved",
//   reserved: "Reserved",
//   ordered: "Ordered",
//   fulfilled: "Fulfilled",
//   rejected: "Rejected",
//   cancelled: "Cancelled",
// };

// const WISH_STATUS_COLORS: Record<string, string> = {
//   pending:
//     "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400",
//   offered:
//     "text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400",
//   reserved:
//     "text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400",
//   rejected:
//     "text-red-600 border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 dark:text-red-400",
//   cancelled: "text-muted-foreground border-border",
//   ordered:
//     "text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400",
//   fulfilled:
//     "text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400",
// };

// function RequestedDevicesTab({
//   wishes,
//   userEmails,
//   isLoading,
//   onViewWish,
// }: {
//   wishes: any[];
//   userEmails: Record<string, string>;
//   isLoading: boolean;
//   onViewWish: (wish: any) => void;
// }) {
//   if (isLoading) return <Loader text="Loading requests..." />;
//
//   if (wishes.length === 0) {
//     return (
//       <EmptyState
//         title="No pre-order requests"
//         description="When customers submit pre-order requests, they will appear here."
//       />
//     );
//   }
//
//   return (
//     <div className="overflow-hidden rounded-lg border border-border bg-card">
//       <div className="overflow-x-auto">
//         <table className="w-full">
//           <thead>
//             <tr className="border-b border-border bg-muted/50">
//               <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
//                 Customer
//               </th>
//               <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
//                 Device
//               </th>
//               <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
//                 Grade
//               </th>
//               <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
//                 Storage
//               </th>
//               <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
//                 Qty
//               </th>
//               <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
//                 Budget
//               </th>
//               <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
//                 Offer Price
//               </th>
//               <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
//                 Status
//               </th>
//               <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
//                 Date
//               </th>
//               <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
//                 Action
//               </th>
//             </tr>
//           </thead>
//           <tbody className="divide-y divide-border">
//             {wishes.map((wish, index) => (
//               <tr
//                 key={wish.id}
//                 className={cn(
//                   "transition-colors hover:bg-table-hover",
//                   index % 2 === 1 && "bg-table-zebra"
//                 )}
//               >
//                 <td className="px-6 py-4 text-sm text-foreground">
//                   {userEmails[wish.userId] ?? wish.userId?.slice(0, 8) + "…"}
//                 </td>
//                 <td className="px-4 py-4 text-sm font-medium text-foreground">
//                   {wish.model}
//                 </td>
//                 <td className="px-4 py-4 text-sm text-foreground">
//                   {wish.grade}
//                 </td>
//                 <td className="px-4 py-4 text-sm text-foreground">
//                   {wish.storage}
//                 </td>
//                 <td className="px-4 py-4 text-center text-sm text-foreground">
//                   {wish.qtyWanted}
//                 </td>
//                 <td className="px-4 py-4 text-right text-sm text-foreground">
//                   {wish.maxPricePerUnit != null
//                     ? formatPrice(wish.maxPricePerUnit)
//                     : <span className="text-muted-foreground">—</span>}
//                 </td>
//                 <td className="px-4 py-4 text-right text-sm text-foreground">
//                   {wish.offerPricePerUnit != null
//                     ? formatPrice(wish.offerPricePerUnit)
//                     : <span className="text-muted-foreground">—</span>}
//                 </td>
//                 <td className="px-4 py-4 text-center">
//                   <Badge
//                     variant="outline"
//                     className={cn(
//                       "text-xs",
//                       WISH_STATUS_COLORS[wish.status] ?? ""
//                     )}
//                   >
//                     {WISH_STATUS_LABELS[wish.status] ?? wish.status}
//                   </Badge>
//                 </td>
//                 <td className="px-4 py-4 text-sm text-muted-foreground">
//                   {formatDateInOntario(wish.createdAt)}
//                 </td>
//                 <td className="px-6 py-4 text-center">
//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     onClick={() => onViewWish(wish)}
//                     className="h-8 w-8"
//                   >
//                     <Eye className="h-4 w-4" />
//                   </Button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }
