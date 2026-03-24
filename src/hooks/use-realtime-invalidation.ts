'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtimeContext } from '@/contexts/RealtimeContext'
import { queryKeys } from '@/lib/query-keys'

export function useRealtimeInvalidation() {
  const queryClient = useQueryClient()
  const { inventoryVersion, ordersVersion, userProfilesVersion } =
    useRealtimeContext()

  const initialRef = useRef({
    inventory: inventoryVersion,
    orders: ordersVersion,
    users: userProfilesVersion,
  })

  useEffect(() => {
    if (inventoryVersion === initialRef.current.inventory) return
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
  }, [inventoryVersion, queryClient])

  useEffect(() => {
    if (ordersVersion === initialRef.current.orders) return
    queryClient.invalidateQueries({ queryKey: queryKeys.orders })
    // Also invalidate user-specific orders since they share the same table
    queryClient.invalidateQueries({ queryKey: ['paginated', 'userOrders'] })
  }, [ordersVersion, queryClient])

  useEffect(() => {
    if (userProfilesVersion === initialRef.current.users) return
    queryClient.invalidateQueries({ queryKey: queryKeys.users })
  }, [userProfilesVersion, queryClient])
}
