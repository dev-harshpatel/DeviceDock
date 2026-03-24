"use client";

import { useState } from "react";
import { SuperAdminNavbar } from "@/components/layout/SuperAdminNavbar";
import { SuperAdminSidebar } from "@/components/layout/SuperAdminSidebar";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="h-dvh flex w-full bg-background overflow-hidden">
      <SuperAdminSidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <SuperAdminNavbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 flex flex-col min-h-0 p-4 lg:p-6 overflow-hidden">
          <div className="max-w-7xl mx-auto w-full flex flex-col flex-1 min-h-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
