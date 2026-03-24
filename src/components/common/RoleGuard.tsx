'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanyRoute } from '@/hooks/useCompanyRoute';
import type { CompanyRole } from '@/types/company';

interface RoleGuardProps {
  /** Roles that are allowed to view this page. All others are redirected to dashboard. */
  allowedRoles: CompanyRole[];
  children: React.ReactNode;
}

/**
 * Redirects to the company dashboard if the current user's role is not in allowedRoles.
 * Use this to protect page-level routes from unauthorized access.
 */
export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { role } = useCompany();
  const router = useRouter();
  const { companyRoute } = useCompanyRoute();

  const isAllowed = allowedRoles.includes(role);

  useEffect(() => {
    if (!isAllowed) {
      router.replace(companyRoute('/dashboard'));
    }
  }, [isAllowed, router, companyRoute]);

  if (!isAllowed) return null;

  return <>{children}</>;
}
