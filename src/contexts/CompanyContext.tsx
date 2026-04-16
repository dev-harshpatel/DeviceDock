"use client";

import { createContext, useContext } from "react";
import type { Company, CompanyMembership, CompanyRole } from "@/types/company";

interface CompanyContextType {
  company: Company;
  membership: CompanyMembership;
  /** Shorthand: company.id */
  companyId: string;
  /** Shorthand: company.slug */
  slug: string;
  /** Shorthand: company.name */
  companyName: string;
  role: CompanyRole;
  isOwner: boolean;
  isManager: boolean;
  isInventoryAdmin: boolean;
  isAnalyst: boolean;
  /** True if role can write/edit inventory */
  canWrite: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

interface CompanyProviderProps {
  company: Company;
  membership: CompanyMembership;
  children: React.ReactNode;
}

export function CompanyProvider({ company, membership, children }: CompanyProviderProps) {
  const role = membership.role;

  const value: CompanyContextType = {
    company,
    membership,
    companyId: company.id,
    slug: company.slug,
    companyName: company.name,
    role,
    isOwner: role === "owner",
    isManager: role === "manager",
    isInventoryAdmin: role === "inventory_admin",
    isAnalyst: role === "analyst",
    canWrite: role === "owner" || role === "manager" || role === "inventory_admin",
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextType {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}

/** For hooks that run in the root layout (e.g. realtime bridge) where company may be absent. */
export function useOptionalCompany(): CompanyContextType | undefined {
  return useContext(CompanyContext);
}
