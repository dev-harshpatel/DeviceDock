import { supabaseAdmin } from "@/lib/supabase/client/admin";

export interface TenantHealthMetrics {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyStatus: string;
  createdAt: string;
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

export interface TenantHealthSummary {
  activeCompanies: number;
  averageHealthScore: number;
  totalCompanies: number;
  totalOrdersLast30Days: number;
  totalUniqueActiveUsers30Days: number;
}

export interface TenantHealthResponse {
  companies: TenantHealthMetrics[];
  summary: TenantHealthSummary;
}

interface BaseCompanyRow {
  created_at: string;
  id: string;
  name: string;
  slug: string;
  status: string;
  updated_at: string;
}

interface CompanyUserRow {
  company_id: string;
  created_at: string;
  status: string;
  updated_at: string;
  user_id: string;
}

interface InventoryRow {
  company_id: string;
  created_at: string;
  quantity: number;
  updated_at: string;
}

interface OrderRow {
  company_id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getTime = (date: string | null) => {
  if (!date) {
    return 0;
  }
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
};

const getHealthStatus = (score: number): TenantHealthMetrics["healthStatus"] => {
  if (score >= 75) {
    return "healthy";
  }
  if (score >= 45) {
    return "attention";
  }
  return "critical";
};

const clampScore = (score: number) => {
  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return Math.round(score);
};

const calculateHealthScore = ({
  companyStatus,
  inventoryRecords,
  lastActivityAt,
  ordersLast30Days,
  ordersPrevious30Days,
  uniqueActiveUsers30Days,
}: Omit<TenantHealthMetrics, "companyId" | "companyName" | "companySlug" | "createdAt" | "healthScore" | "healthStatus" | "inventoryUnits" | "monthlyOrderTrendPercent">) => {
  let score = 0;
  const now = Date.now();
  const lastActivityMs = getTime(lastActivityAt);
  const daysSinceLastActivity =
    lastActivityMs > 0 ? (now - lastActivityMs) / DAY_IN_MS : Number.POSITIVE_INFINITY;

  if (companyStatus === "active") {
    score += 25;
  }

  if (daysSinceLastActivity <= 7) {
    score += 25;
  } else if (daysSinceLastActivity <= 30) {
    score += 15;
  } else if (daysSinceLastActivity <= 60) {
    score += 8;
  } else {
    score += 2;
  }

  if (uniqueActiveUsers30Days >= 5) {
    score += 20;
  } else if (uniqueActiveUsers30Days >= 1) {
    score += 12;
  }

  if (ordersLast30Days > ordersPrevious30Days) {
    score += 15;
  } else if (ordersLast30Days > 0) {
    score += 10;
  } else if (ordersPrevious30Days > 0) {
    score += 5;
  }

  if (inventoryRecords > 0) {
    score += 15;
  } else {
    score += 5;
  }

  return clampScore(score);
};

const calculateTrendPercent = (current: number, previous: number) => {
  if (previous <= 0) {
    if (current <= 0) {
      return 0;
    }
    return 100;
  }

  return Math.round(((current - previous) / previous) * 100);
};

export const getTenantHealthAnalytics = async (): Promise<TenantHealthResponse> => {
  const [companiesResult, usersResult, inventoryResult, ordersResult] = await Promise.all([
    supabaseAdmin
      .from("companies")
      .select("id, name, slug, status, created_at, updated_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("company_users")
      .select("company_id, user_id, status, created_at, updated_at"),
    supabaseAdmin
      .from("inventory")
      .select("company_id, quantity, created_at, updated_at"),
    supabaseAdmin
      .from("orders")
      .select("company_id, user_id, created_at, updated_at"),
  ]);

  if (companiesResult.error) {
    throw new Error(companiesResult.error.message);
  }
  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }
  if (inventoryResult.error) {
    throw new Error(inventoryResult.error.message);
  }
  if (ordersResult.error) {
    throw new Error(ordersResult.error.message);
  }

  const companies = (companiesResult.data ?? []) as BaseCompanyRow[];
  const companyUsers = (usersResult.data ?? []) as CompanyUserRow[];
  const inventoryRows = (inventoryResult.data ?? []) as InventoryRow[];
  const orderRows = (ordersResult.data ?? []) as OrderRow[];

  const now = Date.now();
  const last30Days = now - 30 * DAY_IN_MS;
  const last60Days = now - 60 * DAY_IN_MS;

  const usersByCompany = companyUsers.reduce<Record<string, CompanyUserRow[]>>((accumulator, row) => {
    if (!accumulator[row.company_id]) {
      accumulator[row.company_id] = [];
    }
    accumulator[row.company_id].push(row);
    return accumulator;
  }, {});

  const inventoryByCompany = inventoryRows.reduce<Record<string, InventoryRow[]>>((accumulator, row) => {
    if (!accumulator[row.company_id]) {
      accumulator[row.company_id] = [];
    }
    accumulator[row.company_id].push(row);
    return accumulator;
  }, {});

  const ordersByCompany = orderRows.reduce<Record<string, OrderRow[]>>((accumulator, row) => {
    if (!accumulator[row.company_id]) {
      accumulator[row.company_id] = [];
    }
    accumulator[row.company_id].push(row);
    return accumulator;
  }, {});

  const metrics = companies.map<TenantHealthMetrics>((company) => {
    const companyUserRows = usersByCompany[company.id] ?? [];
    const companyInventoryRows = inventoryByCompany[company.id] ?? [];
    const companyOrderRows = ordersByCompany[company.id] ?? [];

    const activeUsersSet = new Set<string>();
    companyOrderRows.forEach((order) => {
      const createdAtMs = getTime(order.created_at);
      if (createdAtMs >= last30Days) {
        activeUsersSet.add(order.user_id);
      }
    });

    const ordersLast30Days = companyOrderRows.filter(
      (order) => getTime(order.created_at) >= last30Days,
    ).length;

    const ordersPrevious30Days = companyOrderRows.filter((order) => {
      const createdAtMs = getTime(order.created_at);
      return createdAtMs >= last60Days && createdAtMs < last30Days;
    }).length;

    const inventoryUnits = companyInventoryRows.reduce(
      (sum, row) => sum + Number(row.quantity ?? 0),
      0,
    );

    const lastActivityCandidates: Array<string | null> = [
      company.updated_at,
      ...companyUserRows.map((row) => row.updated_at || row.created_at),
      ...companyInventoryRows.map((row) => row.updated_at || row.created_at),
      ...companyOrderRows.map((row) => row.updated_at || row.created_at),
    ];

    const lastActivityAt =
      lastActivityCandidates
        .filter((value): value is string => Boolean(value))
        .sort((first, second) => getTime(second) - getTime(first))[0] ?? null;

    const healthScore = calculateHealthScore({
      companyStatus: company.status,
      inventoryRecords: companyInventoryRows.length,
      lastActivityAt,
      ordersLast30Days,
      ordersPrevious30Days,
      uniqueActiveUsers30Days: activeUsersSet.size,
    });

    return {
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug,
      companyStatus: company.status,
      createdAt: company.created_at,
      healthScore,
      healthStatus: getHealthStatus(healthScore),
      inventoryRecords: companyInventoryRows.length,
      inventoryUnits,
      lastActivityAt,
      monthlyOrderTrendPercent: calculateTrendPercent(ordersLast30Days, ordersPrevious30Days),
      ordersLast30Days,
      ordersPrevious30Days,
      uniqueActiveUsers30Days: activeUsersSet.size,
    };
  });

  const summary: TenantHealthSummary = {
    activeCompanies: companies.filter((company) => company.status === "active").length,
    averageHealthScore:
      metrics.length > 0
        ? Math.round(
            metrics.reduce((sum, metric) => sum + metric.healthScore, 0) / metrics.length,
          )
        : 0,
    totalCompanies: companies.length,
    totalOrdersLast30Days: metrics.reduce(
      (sum, metric) => sum + metric.ordersLast30Days,
      0,
    ),
    totalUniqueActiveUsers30Days: metrics.reduce(
      (sum, metric) => sum + metric.uniqueActiveUsers30Days,
      0,
    ),
  };

  return {
    companies: metrics,
    summary,
  };
};
