"use client";

import { ReactNode, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { AppSidebar } from "@/components/layout/AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="h-dvh flex w-full bg-background overflow-hidden">
      <AppSidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 flex flex-col min-h-0 p-4 lg:p-6 overflow-hidden">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
