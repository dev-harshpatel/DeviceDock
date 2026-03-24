'use client'

import { useEffect, useRef } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { PAGE_SIZE } from '@/hooks/use-paginated-query'

export { PAGE_SIZE }

export interface PaginatedResult<T> {
  data: T[]
  count: number
}

export interface UsePaginatedReactQueryOptions<T> {
  queryKey: readonly unknown[]
  fetchFn: (range: { from: number; to: number }) => Promise<PaginatedResult<T>>
  currentPage: number
  setCurrentPage: (page: number) => void
  pageSize?: number
  enabled?: boolean
  filtersKey?: string
  refetchOnWindowFocus?: boolean
}

export interface UsePaginatedReactQueryReturn<T> {
  data: T[]
  totalCount: number
  totalPages: number
  isLoading: boolean
  isFetching: boolean
  rangeText: string
}

export function usePaginatedReactQuery<T>(
  options: UsePaginatedReactQueryOptions<T>,
): UsePaginatedReactQueryReturn<T> {
  const {
    queryKey,
    fetchFn,
    currentPage,
    setCurrentPage,
    pageSize = PAGE_SIZE,
    enabled = true,
    filtersKey,
    refetchOnWindowFocus,
  } = options

  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  const query = useQuery({
    queryKey,
    queryFn: () => fetchFn({ from, to }),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus,
  })

  const data = query.data?.data ?? []
  const totalCount = query.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // Reset to page 1 when filters change
  const prevFiltersRef = useRef(filtersKey)
  useEffect(() => {
    if (filtersKey !== undefined && prevFiltersRef.current !== filtersKey) {
      prevFiltersRef.current = filtersKey
      setCurrentPage(1)
    }
  }, [filtersKey, setCurrentPage])

  // Clamp page if it exceeds totalPages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0 && !query.isLoading) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages, query.isLoading, setCurrentPage])

  const rangeFrom = (currentPage - 1) * pageSize + 1
  const rangeTo = Math.min(currentPage * pageSize, totalCount)
  const rangeText =
    totalCount > 0 ? `${rangeFrom}-${rangeTo} of ${totalCount}` : '0 items'

  return {
    data,
    totalCount,
    totalPages,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    rangeText,
  }
}
