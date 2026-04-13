import { useCallback } from "react";
import { useCompany } from "@/contexts/CompanyContext";

/**
 * Returns a helper that prepends the company slug to any path.
 * Usage:
 *   const { companyRoute } = useCompanyRoute();
 *   companyRoute('/orders') // → '/acme-electronics/orders'
 */
export function useCompanyRoute() {
  const { slug } = useCompany();

  const companyRoute = useCallback(
    (path: string): string => {
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      return `/${slug}${cleanPath}`;
    },
    [slug],
  );

  return { companyRoute, slug };
}
