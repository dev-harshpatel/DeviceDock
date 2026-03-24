"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, ChevronRight, ScrollText, X } from "lucide-react";
import { Blocks } from "@/components/animate-ui/icons/blocks";
import { cn } from "@/lib/utils";

interface SuperAdminSidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

function DashboardIcon({ className }: { className?: string }) {
  return <Blocks animateOnHover className={className} />;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: DashboardIcon, path: "/superadmin/dashboard" },
  { label: "Tenant Health", icon: Activity, path: "/superadmin/tenant-health" },
  { label: "Companies", icon: Building2, path: "/superadmin/companies" },
  { label: "Audit Logs", icon: ScrollText, path: "/superadmin/audit-logs" },
];

export function SuperAdminSidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
}: SuperAdminSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border flex-shrink-0">
        {!collapsed && (
          <span className="text-sm font-semibold text-foreground truncate">
            Super Admin
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-auto"
          aria-label="Toggle sidebar"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              !collapsed && "rotate-180"
            )}
          />
        </button>
        <button
          onClick={onClose}
          className="lg:hidden h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div
        className={cn(
          "hidden lg:flex flex-col bg-card border-r border-border transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
}
