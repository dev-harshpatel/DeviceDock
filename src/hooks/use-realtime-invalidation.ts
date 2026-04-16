"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { useOptionalCompany } from "@/contexts/CompanyContext";
import { queryKeys } from "@/lib/query-keys";

export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const company = useOptionalCompany();
  const companyId = company?.companyId;
  const { inventoryVersion, notificationVersion, ordersVersion, userProfilesVersion } =
    useRealtimeContext();

  const initialRef = useRef({
    inventory: inventoryVersion,
    notifications: notificationVersion,
    orders: ordersVersion,
    users: userProfilesVersion,
  });

  useEffect(() => {
    if (inventoryVersion === initialRef.current.inventory) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    queryClient.invalidateQueries({ queryKey: ["inventory", "all"] });
    if (companyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats(companyId) });
    }
  }, [inventoryVersion, companyId, queryClient]);

  useEffect(() => {
    if (notificationVersion === initialRef.current.notifications) return;
    // Prefix match — invalidates all ["notifications", "feed", *] entries
    queryClient.invalidateQueries({ queryKey: ["notifications", "feed"] });
  }, [notificationVersion, queryClient]);

  useEffect(() => {
    if (ordersVersion === initialRef.current.orders) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    queryClient.invalidateQueries({ queryKey: ["orders", "all"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.userOrdersBase });
    if (companyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.orderStats(companyId) });
    }
  }, [ordersVersion, companyId, queryClient]);

  useEffect(() => {
    if (userProfilesVersion === initialRef.current.users) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.users });
  }, [userProfilesVersion, queryClient]);
}
