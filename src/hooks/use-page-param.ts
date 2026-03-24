'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export function usePageParam(paramName = 'page', defaultValue = 1) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentPage = useMemo(() => {
    const param = searchParams.get(paramName)
    if (!param) return defaultValue
    const parsed = parseInt(param, 10)
    return isNaN(parsed) || parsed < 1 ? defaultValue : parsed
  }, [searchParams, paramName, defaultValue])

  const setPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())

      if (page === defaultValue) {
        params.delete(paramName)
      } else {
        params.set(paramName, page.toString())
      }

      const query = params.toString()
      const url = query ? `${pathname}?${query}` : pathname
      router.replace(url, { scroll: false })
    },
    [router, pathname, searchParams, paramName, defaultValue],
  )

  return [currentPage, setPage] as const
}
