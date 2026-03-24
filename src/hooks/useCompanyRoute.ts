import { useCompany } from '@/contexts/CompanyContext';

/**
 * Returns a helper that prepends the company slug to any path.
 * Usage:
 *   const { companyRoute } = useCompanyRoute();
 *   companyRoute('/orders') // → '/peel-wireless/orders'
 */
export function useCompanyRoute() {
  const { slug } = useCompany();

  const companyRoute = (path: string): string => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `/${slug}${cleanPath}`;
  };

  return { companyRoute, slug };
}
