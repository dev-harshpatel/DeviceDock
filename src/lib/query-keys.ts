import type { InventoryFilters, OrdersFilters } from "./supabase/queries";

export const queryKeys = {
  // Base keys for invalidation
  inventory: ["paginated", "inventory"] as const,
  orders: ["paginated", "orders"] as const,
  deletedOrders: ["paginated", "deletedOrders"] as const,
  userOrders: (userId: string) => ["paginated", "userOrders", userId] as const,
  userOrdersBase: ["paginated", "userOrders"] as const,
  users: ["paginated", "users"] as const,

  /** Paginated IMEI / serial identifier list (IMEI Lookup → All IMEIs) */
  identifiersList: ["paginated", "identifiers"] as const,

  /** Full (unpaginated) identifier map for O(1) in-memory lookup — keyed by companyId */
  identifierMapAll: (companyId: string) => ["identifiers", "map", companyId] as const,

  identifiersPage: (companyId: string, page: number, filtersKey: string) =>
    [...queryKeys.identifiersList, companyId, page, filtersKey] as const,

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
    [...queryKeys.orders, page, filters.search] as const,

  deletedOrdersPage: (page: number) => [...queryKeys.deletedOrders, page] as const,

  userOrdersPage: (userId: string, page: number) =>
    [...queryKeys.userOrders(userId), page] as const,

  usersPage: (page: number, search: string) => [...queryKeys.users, page, search] as const,

  companyMembers: (companyId: string) => ["company", companyId, "members"] as const,

  companyInvitations: (companyId: string) => ["company", companyId, "invitations"] as const,

  filterOptions: (companyId: string) => ["filterOptions", companyId] as const,

  notificationsFeed: (companyId: string) => ["notifications", "feed", companyId] as const,

  userEmails: (userIdsKey: string) => ["userEmails", userIdsKey] as const,

  inventoryAll: (companyId: string) => ["inventory", "all", companyId] as const,
  ordersAll: (companyId: string) => ["orders", "all", companyId] as const,

  orderDetail: (id: string) => ["order", "detail", id] as const,

  inventoryStats: (companyId: string) => ["inventoryStats", companyId] as const,
  orderStats: (companyId: string) => ["orderStats", companyId] as const,

  damageNotes: (inventoryId: string) => ["damageNotes", inventoryId] as const,

  superAdminHealth: ["superadmin", "health"] as const,
  superAdminCompanies: ["superadmin", "companies"] as const,
  superAdminAuditLogs: (
    page: number,
    q: string,
    action: string,
    resourceType: string,
    companyId: string,
    from: string,
    to: string,
  ) => ["superadmin", "audit-logs", page, q, action, resourceType, companyId, from, to] as const,
};
