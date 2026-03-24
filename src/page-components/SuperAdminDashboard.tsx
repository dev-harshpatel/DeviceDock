"use client";

import { useEffect, useState } from "react";
import { Building2, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/common/StatCard";
import { Loader } from "@/components/common/Loader";
import { cn } from "@/lib/utils";

interface TenantHealthCompany {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyStatus: string;
  healthScore: number;
  healthStatus: "attention" | "critical" | "healthy";
  inventoryRecords: number;
  inventoryUnits: number;
  lastActivityAt: string | null;
  monthlyOrderTrendPercent: number;
  ordersLast30Days: number;
  uniqueActiveUsers30Days: number;
}

interface TenantHealthSummary {
  activeCompanies: number;
  averageHealthScore: number;
  totalCompanies: number;
  totalOrdersLast30Days: number;
  totalUniqueActiveUsers30Days: number;
}

interface TenantHealthResponse {
  companies: TenantHealthCompany[];
  summary: TenantHealthSummary;
}

const getHealthBadgeClass = (status: TenantHealthCompany["healthStatus"]) => {
  if (status === "healthy") {
    return "border-success text-success";
  }
  if (status === "attention") {
    return "border-warning text-warning";
  }
  return "border-destructive text-destructive";
};

const formatTrend = (trend: number) => {
  if (trend > 0) {
    return `+${trend}%`;
  }
  return `${trend}%`;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<TenantHealthSummary | null>(null);
  const [companies, setCompanies] = useState<TenantHealthCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/superadmin/tenant-health");
        const json = (await res.json()) as TenantHealthResponse;

        const companyRows = (json.companies ?? []).sort(
          (first, second) => second.healthScore - first.healthScore,
        );
        setCompanies(companyRows);
        setStats(json.summary);
      } catch {
        setCompanies([]);
        setStats({
          activeCompanies: 0,
          averageHealthScore: 0,
          totalCompanies: 0,
          totalOrdersLast30Days: 0,
          totalUniqueActiveUsers30Days: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  if (isLoading) {
    return <Loader size="lg" text="Loading dashboard..." />;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Platform Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of all companies on the platform
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Companies"
            value={stats?.totalCompanies ?? 0}
            icon={<Building2 className="h-5 w-5" />}
            accent="primary"
          />
          <StatCard
            title="Active Companies"
            value={stats?.activeCompanies ?? 0}
            icon={<ShieldCheck className="h-5 w-5" />}
            accent="success"
          />
          <StatCard
            title="Active Users (30d)"
            value={stats?.totalUniqueActiveUsers30Days ?? 0}
            icon={<Users className="h-5 w-5" />}
            accent="primary"
          />
          <StatCard
            title="Orders (30d)"
            value={stats?.totalOrdersLast30Days ?? 0}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="warning"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6 lg:col-span-1">
            <h3 className="font-semibold text-foreground">Platform Health</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Weighted health score derived from activity, engagement, and usage trends.
            </p>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">
                {stats?.averageHealthScore ?? 0}
                <span className="ml-1 text-sm font-medium text-muted-foreground">/100</span>
              </p>
            </div>
            <a
              href="/superadmin/companies"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Building2 className="h-4 w-4" />
              Manage companies →
            </a>
          </div>

          <div className="rounded-lg border border-border bg-card lg:col-span-2">
            <div className="border-b border-border px-6 py-4">
              <h3 className="font-semibold text-foreground">Tenant Health & Usage</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Top tenants by health score with 30-day activity and order trend.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-3 text-left font-medium">Company</th>
                    <th className="px-4 py-3 text-left font-medium">Health</th>
                    <th className="px-4 py-3 text-right font-medium">Active users (30d)</th>
                    <th className="px-4 py-3 text-right font-medium">Orders (30d)</th>
                    <th className="px-4 py-3 text-right font-medium">Trend</th>
                    <th className="px-4 py-3 text-right font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companies.slice(0, 8).map((company) => (
                    <tr key={company.companyId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <p className="font-medium text-foreground">{company.companyName}</p>
                        <p className="text-xs text-muted-foreground">/{company.companySlug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("text-xs", getHealthBadgeClass(company.healthStatus))}
                          >
                            {company.healthStatus}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{company.healthScore}/100</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {company.uniqueActiveUsers30Days}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {company.ordersLast30Days}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-medium",
                          company.monthlyOrderTrendPercent > 0 && "text-success",
                          company.monthlyOrderTrendPercent < 0 && "text-destructive",
                          company.monthlyOrderTrendPercent === 0 && "text-muted-foreground",
                        )}
                      >
                        {formatTrend(company.monthlyOrderTrendPercent)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {company.lastActivityAt
                          ? new Date(company.lastActivityAt).toLocaleDateString()
                          : "No activity"}
                      </td>
                    </tr>
                  ))}

                  {companies.length === 0 && (
                    <tr>
                      <td className="px-6 py-8 text-center text-sm text-muted-foreground" colSpan={6}>
                        No tenant metrics available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
