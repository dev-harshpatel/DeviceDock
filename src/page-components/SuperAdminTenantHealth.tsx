"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  averageHealthScore: number;
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
};

export default function SuperAdminTenantHealth() {
  const [companies, setCompanies] = useState<TenantHealthCompany[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [averageScore, setAverageScore] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/superadmin/tenant-health");
        const json = (await response.json()) as TenantHealthResponse;

        const rows = (json.companies ?? []).sort(
          (first, second) => second.healthScore - first.healthScore,
        );
        setCompanies(rows);
        setAverageScore(json.summary?.averageHealthScore ?? 0);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filteredCompanies = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return companies;
    }
    return companies.filter((company) => {
      return (
        company.companyName.toLowerCase().includes(term) ||
        company.companySlug.toLowerCase().includes(term)
      );
    });
  }, [companies, searchQuery]);

  if (isLoading) {
    return <Loader size="lg" text="Loading tenant health..." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 -mx-4 mb-4 space-y-4 border-b border-border bg-background px-4 pb-4 pt-4 lg:-mx-6 lg:px-6 lg:pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Activity className="h-6 w-6" />
            Tenant Health
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform average health score: {averageScore}/100
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by company name or slug..."
            value={searchQuery}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto -mx-4 px-4 lg:-mx-6 lg:px-6">
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Health</th>
                <th className="px-4 py-3 text-right font-medium">Active users (30d)</th>
                <th className="px-4 py-3 text-right font-medium">Orders (30d)</th>
                <th className="px-4 py-3 text-right font-medium">Trend</th>
                <th className="px-4 py-3 text-right font-medium">Inventory units</th>
                <th className="px-4 py-3 text-right font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCompanies.map((company) => (
                <tr key={company.companyId} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{company.companyName}</p>
                    <p className="text-xs text-muted-foreground">/{company.companySlug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn("text-xs", getHealthBadgeClass(company.healthStatus))}
                        variant="outline"
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
                  <td className="px-4 py-3 text-right text-foreground">
                    {company.inventoryUnits}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {company.lastActivityAt
                      ? new Date(company.lastActivityAt).toLocaleDateString()
                      : "No activity"}
                  </td>
                </tr>
              ))}

              {filteredCompanies.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={7}>
                    No tenants found for this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
