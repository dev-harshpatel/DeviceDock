export const PAGE_SIZE = 10

export interface PaginatedResult<T> {
  data: T[]
  count: number
}
