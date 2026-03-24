'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase/client'

interface RealtimeContextType {
  inventoryVersion: number
  ordersVersion: number
  userProfilesVersion: number
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

interface RealtimeProviderProps {
  children: ReactNode
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const [inventoryVersion, setInventoryVersion] = useState(0)
  const [ordersVersion, setOrdersVersion] = useState(0)
  const [userProfilesVersion, setUserProfilesVersion] = useState(0)

  useEffect(() => {
    const inventoryChannel = supabase
      .channel('realtime-inventory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => setInventoryVersion((prev) => prev + 1)
      )
      .subscribe()

    const ordersChannel = supabase
      .channel('realtime-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => setOrdersVersion((prev) => prev + 1)
      )
      .subscribe()

    const userProfilesChannel = supabase
      .channel('realtime-user-profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => setUserProfilesVersion((prev) => prev + 1)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(inventoryChannel)
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(userProfilesChannel)
    }
  }, [])

  return (
    <RealtimeContext.Provider
      value={{ inventoryVersion, ordersVersion, userProfilesVersion }}
    >
      {children}
    </RealtimeContext.Provider>
  )
}

const DEFAULT_REALTIME: RealtimeContextType = {
  inventoryVersion: 0,
  ordersVersion: 0,
  userProfilesVersion: 0,
}

export function useRealtimeContext(): RealtimeContextType {
  const context = useContext(RealtimeContext)
  return context ?? DEFAULT_REALTIME
}
