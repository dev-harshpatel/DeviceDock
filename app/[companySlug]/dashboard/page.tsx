import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { getCompanyBySlug } from "@/lib/supabase/auth-helpers";
import { fetchInventoryStats, fetchOrderStats } from "@/lib/supabase/queries";
import { queryKeys } from "@/lib/query-keys";
import Dashboard from "@/page-components/Dashboard";

interface DashboardPageProps {
  params: Promise<{ companySlug: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);

  if (!company) {
    return <Dashboard />;
  }

  const queryClient = new QueryClient();

  // Parallel prefetch of dashboard aggregate metrics
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.inventoryStats(company.id),
      queryFn: () => fetchInventoryStats(company.id),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.orderStats(company.id),
      queryFn: () => fetchOrderStats(company.id),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Dashboard />
    </HydrationBoundary>
  );
}
