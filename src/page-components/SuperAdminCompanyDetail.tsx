"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/common/Loader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

interface CompanyUser {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  status: string;
  joinedAt: string;
}

interface CompanyHealth {
  healthScore: number;
  healthStatus: "attention" | "critical" | "healthy";
  inventoryRecords: number;
  inventoryUnits: number;
  lastActivityAt: string | null;
  monthlyOrderTrendPercent: number;
  ordersLast30Days: number;
  ordersPrevious30Days: number;
  uniqueActiveUsers30Days: number;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  inventory_admin: "Inventory Admin",
  analyst: "Analyst",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        status === "active" && "border-success text-success",
        status === "suspended" && "border-warning text-warning",
        status === "inactive" && "border-muted-foreground text-muted-foreground"
      )}
    >
      {status}
    </Badge>
  );
}

export default function SuperAdminCompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [health, setHealth] = useState<CompanyHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [companyRes, usersRes, healthRes] = await Promise.all([
        fetch(`/api/superadmin/companies/${companyId}`),
        fetch(`/api/superadmin/companies/${companyId}/users`),
        fetch(`/api/superadmin/tenant-health/${companyId}`),
      ]);
      const companyJson = await companyRes.json() as { company: Company };
      const usersJson = await usersRes.json() as { users: CompanyUser[] };
      const healthJson = await healthRes.json() as { company?: CompanyHealth };
      setCompany(companyJson.company ?? null);
      setUsers(usersJson.users ?? []);
      setHealth(healthJson.company ?? null);
    } catch {
      toast.error("Failed to load company details");
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleStatus = async () => {
    if (!company) return;
    const newStatus = company.status === "active" ? "suspended" : "active";
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/superadmin/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      setCompany((c) => c ? { ...c, status: newStatus } : c);
      toast.success(`Company ${newStatus === "active" ? "activated" : "suspended"}`);
    } catch {
      toast.error("Failed to update company status");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) return <Loader size="lg" text="Loading company..." />;
  if (!company) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-muted-foreground">Company not found.</p>
      <Button variant="outline" onClick={() => router.push("/superadmin/companies")}>
        Back to companies
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-6 pb-6">
        {/* Back + header */}
        <div>
          <button
            onClick={() => router.push("/superadmin/companies")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Companies
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {company.name}
                </h2>
                <p className="text-sm text-muted-foreground font-mono">
                  /{company.slug}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <StatusBadge status={company.status} />
              <Button
                variant="outline"
                size="sm"
                disabled={isUpdating}
                onClick={handleToggleStatus}
                className={cn(
                  company.status === "active"
                    ? "text-warning hover:text-warning"
                    : "text-success hover:text-success"
                )}
              >
                {company.status === "active" ? "Suspend Company" : "Activate Company"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Registered {new Date(company.created_at).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Health & usage */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Tenant Health & Usage (30d)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Activity and engagement indicators for this tenant.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
            <div className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Health score</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {health?.healthScore ?? 0}
                <span className="ml-1 text-xs text-muted-foreground">/100</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground capitalize">
                {health?.healthStatus ?? "n/a"}
              </p>
            </div>

            <div className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active users</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {health?.uniqueActiveUsers30Days ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
            </div>

            <div className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Orders</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {health?.ordersLast30Days ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Trend: {health ? `${health.monthlyOrderTrendPercent > 0 ? "+" : ""}${health.monthlyOrderTrendPercent}%` : "0%"}
              </p>
            </div>

            <div className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Inventory units</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {health?.inventoryUnits ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {health?.inventoryRecords ?? 0} records
              </p>
            </div>
          </div>

          <div className="px-6 pb-6">
            <p className="text-xs text-muted-foreground">
              Last activity:{" "}
              <span className="text-foreground">
                {health?.lastActivityAt
                  ? new Date(health.lastActivityAt).toLocaleString()
                  : "No activity yet"}
              </span>
            </p>
          </div>
        </div>

        {/* Users */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">
              Members
              <span className="text-muted-foreground font-normal text-sm ml-2">
                {users.length}
              </span>
            </h3>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left py-3 px-6 font-medium">User</th>
                  <th className="text-left py-3 px-4 font-medium">Role</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-6 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-6">
                      <p className="font-medium text-foreground">
                        {u.fullName || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-3 px-6 text-right text-xs text-muted-foreground">
                      {new Date(u.joinedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {u.fullName || u.email}
                    </p>
                    {u.fullName && (
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    )}
                  </div>
                  <StatusBadge status={u.status} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{ROLE_LABELS[u.role] ?? u.role}</span>
                  <span>·</span>
                  <span>Joined {new Date(u.joinedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {users.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No members found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
