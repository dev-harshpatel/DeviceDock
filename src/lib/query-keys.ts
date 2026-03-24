import type { InventoryFilters, OrdersFilters } from './supabase/queries'
import type { OrderStatus } from '@/types/order'

export const queryKeys = {
  // Base keys for invalidation
  inventory: ['paginated', 'inventory'] as const,
  orders: ['paginated', 'orders'] as const,
  userOrders: (userId: string) => ['paginated', 'userOrders', userId] as const,
  users: ['paginated', 'users'] as const,

  // Detailed keys for caching specific page + filter combos
  inventoryPage: (page: number, filters: InventoryFilters) =>
    [
      ...queryKeys.inventory,
      page,
      filters.search,
      filters.brand,
      filters.grade,
      filters.storage,
      filters.priceRange,
      filters.stockStatus,
    ] as const,

  ordersPage: (page: number, filters: OrdersFilters) =>
    [...queryKeys.orders, page, filters.search, filters.status] as const,

  userOrdersPage: (
    userId: string,
    page: number,
    status: OrderStatus | 'all',
  ) => [...queryKeys.userOrders(userId), page, status] as const,

  usersPage: (page: number, search: string) =>
    [...queryKeys.users, page, search] as const,

  companyMembers: (companyId: string) =>
    ['company', companyId, 'members'] as const,

  companyInvitations: (companyId: string) =>
    ['company', companyId, 'invitations'] as const,
}
