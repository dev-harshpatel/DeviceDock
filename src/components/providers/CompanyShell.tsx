'use client';

import { CompanyProvider } from '@/contexts/CompanyContext';
import { InventoryProvider } from '@/contexts/InventoryContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import { AppLayout } from '@/components/layout/AppLayout';
import type { Company, CompanyMembership } from '@/types/company';

interface CompanyShellProps {
  company: Company;
  membership: CompanyMembership;
  children: React.ReactNode;
}

/**
 * Rendered by the [companySlug] server layout.
 * Wraps all company-scoped providers together so they can
 * access CompanyContext (companyId) for data isolation.
 */
export function CompanyShell({ company, membership, children }: CompanyShellProps) {
  return (
    <CompanyProvider company={company} membership={membership}>
      <InventoryProvider>
        <OrdersProvider>
          <AppLayout>{children}</AppLayout>
        </OrdersProvider>
      </InventoryProvider>
    </CompanyProvider>
  );
}
