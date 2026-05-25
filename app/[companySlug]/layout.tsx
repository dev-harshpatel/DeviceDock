import { redirect } from "next/navigation";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client/server";
import { getCompanyBySlug } from "@/lib/supabase/auth-helpers";
import { CompanyShell } from "@/components/providers/CompanyShell";
import { fetchAllInventory, fetchAllOrders, fetchFilterOptions } from "@/lib/supabase/queries";
import { queryKeys } from "@/lib/query-keys";
import type { Database } from "@/lib/database.types";
import type { CompanyMembership } from "@/types/company";

type CompanyUserRow = Database["public"]["Tables"]["company_users"]["Row"];

interface CompanyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ companySlug: string }>;
}

export default async function CompanyLayout({ params, children }: CompanyLayoutProps) {
  const { companySlug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const company = await getCompanyBySlug(companySlug);
  if (!company) redirect("/login");

  const { data: membershipRow, error } = await supabase
    .from("company_users")
    .select("*")
    .eq("user_id", user.id)
    .eq("company_id", company.id)
    .eq("status", "active")
    .single();

  if (error || !membershipRow) redirect("/login");

  const row = membershipRow as CompanyUserRow;

  const membership: CompanyMembership = {
    id: row.id,
    company_id: row.company_id,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  const queryClient = new QueryClient();

  // Parallel prefetch of foundational company data
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.inventoryAll(company.id),
      queryFn: () => fetchAllInventory(company.id),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.ordersAll(company.id),
      queryFn: () => fetchAllOrders(company.id),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.filterOptions(company.id),
      queryFn: () => fetchFilterOptions(company.id),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CompanyShell company={company} membership={membership}>
        {children}
      </CompanyShell>
    </HydrationBoundary>
  );
}
