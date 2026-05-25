"use client";

import dynamic from "next/dynamic";
import { ActiveOrderTableRow } from "@/components/orders/ActiveOrderTableRow";
import { DeletedOrderTableRow } from "@/components/orders/DeletedOrderTableRow";
import { OrdersHeader } from "@/components/orders/OrdersHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { PaginationControls } from "@/components/common/PaginationControls";
import { Loader } from "@/components/common/Loader";
import { useOrdersManagement } from "@/hooks/use-orders-management";

const OrderDetailsModal = dynamic(
  () =>
    import("@/components/modals/OrderDetailsModal").then((mod) => ({
      default: mod.OrderDetailsModal,
    })),
  { loading: () => null, ssr: false },
);

export default function Orders() {
  const {
    activeTab,
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
  } = useOrdersManagement();

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
    </>
  );
}
