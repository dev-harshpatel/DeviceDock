import type { InventoryFilters, OrdersFilters } from "./supabase/queries";
import type { OrderStatus } from "@/types/order";

export const queryKeys = {
  // Base keys for invalidation
  inventory: ["paginated", "inventory"] as const,
  orders: ["paginated", "orders"] as const,
  deletedOrders: ["paginated", "deletedOrders"] as const,
  userOrders: (userId: string) => ["paginated", "userOrders", userId] as const,
  // Prefix for invalidating all userOrders queries regardless of userId
  userOrdersBase: ["paginated", "userOrders"] as const,
  users: ["paginated", "users"] as const,

  /** Paginated IMEI / serial identifier list (IMEI Lookup → All IMEIs) */
  identifiersList: ["paginated", "identifiers"] as const,

  /** Full (unpaginated) identifier map for O(1) in-memory lookup — keyed by companyId */
  identifierMapAll: (companyId: string) => ["identifiers", "map", companyId] as const,

  identifiersPage: (companyId: string, page: number, filtersKey: string) =>
    [...queryKeys.identifiersList, companyId, page, filtersKey] as const,

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
      filters.sortBy,
    ] as const,

  ordersPage: (page: number, filters: OrdersFilters) =>
    [...queryKeys.orders, page, filters.search, filters.status] as const,

  deletedOrdersPage: (page: number) => [...queryKeys.deletedOrders, page] as const,

  userOrdersPage: (userId: string, page: number, status: OrderStatus | "all") =>
    [...queryKeys.userOrders(userId), page, status] as const,

  usersPage: (page: number, search: string) => [...queryKeys.users, page, search] as const,

  companyMembers: (companyId: string) => ["company", companyId, "members"] as const,

  companyInvitations: (companyId: string) => ["company", companyId, "invitations"] as const,

  // Filter options (brands, storage) — staleTime: Infinity, keyed by companyId
  filterOptions: (companyId: string) => ["filterOptions", companyId] as const,

  // Notification events feed — invalidated by notificationVersion realtime counter
  notificationsFeed: (companyId: string) => ["notifications", "feed", companyId] as const,

  // User email lookup — keyed by sorted, comma-joined user IDs; staleTime: Infinity
  userEmails: (userIdsKey: string) => ["userEmails", userIdsKey] as const,

  // Full (unpaginated) lists — used by contexts and "all data" consumers
  // Key root differs from paginated so each can be invalidated independently.
  inventoryAll: (companyId: string) => ["inventory", "all", companyId] as const,
  ordersAll: (companyId: string) => ["orders", "all", companyId] as const,

  // Single order detail — fetched on modal open; separate from paginated list cache
  orderDetail: (id: string) => ["order", "detail", id] as const,

  // Dashboard aggregate stats — fetched via RPC, cached for 5 minutes
  inventoryStats: (companyId: string) => ["inventoryStats", companyId] as const,
  orderStats: (companyId: string) => ["orderStats", companyId] as const,

  // Damage notes per inventory item — staleTime: Infinity, invalidated on new identifier added
  damageNotes: (inventoryId: string) => ["damageNotes", inventoryId] as const,
};
