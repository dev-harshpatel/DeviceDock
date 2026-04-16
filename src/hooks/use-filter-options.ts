"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFilterOptions } from "@/lib/supabase/queries";
import { useCompany } from "@/contexts/CompanyContext";
import { queryKeys } from "@/lib/query-keys";

export function useFilterOptions() {
  const { companyId } = useCompany();

  const { data } = useQuery({
    queryKey: queryKeys.filterOptions(companyId),
    queryFn: () => fetchFilterOptions(companyId),
    staleTime: Infinity,
    enabled: !!companyId,
  });

  return {
    brands: data?.brands ?? [],
    storageOptions: data?.storageOptions ?? [],
  };
}
