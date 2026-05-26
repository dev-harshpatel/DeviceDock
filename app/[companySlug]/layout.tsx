import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/client/server";
import { getCompanyBySlug } from "@/lib/supabase/auth-helpers";
import { CompanyShell } from "@/components/providers/CompanyShell";
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

  return (
    <CompanyShell company={company} membership={membership}>
      {children}
    </CompanyShell>
  );
}
