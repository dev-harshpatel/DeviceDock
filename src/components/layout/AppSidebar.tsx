"use client";

import { useMemo } from "react";
import { NavLink } from "@/components/layout/NavLink";
import { Bell, ChevronLeft, ScanLine, ShoppingBag, X } from "lucide-react";
import { Blocks } from "@/components/animate-ui/icons/blocks";
import { Users } from "@/components/animate-ui/icons/users";
import { ChartLine } from "@/components/animate-ui/icons/chart-line";
import { HandCoinsIcon } from "@/components/ui/hand-coins";
import { SettingsIcon } from "@/components/ui/settings";
import { BoxIcon } from "@/components/ui/box";
import { SquarePenIcon } from "@/components/ui/square-pen";
import { UploadIcon } from "@/components/ui/upload";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompanyRoute } from "@/hooks/useCompanyRoute";
import { useNotificationSettings } from "@/contexts/NotificationSettingsContext";
import { useNotificationsFeed } from "@/hooks/use-notifications-feed";

interface AppSidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

function DashboardIcon({ className }: { className?: string }) {
  return <Blocks animateOnHover className={className} />;
}

function InventoryIcon({ className }: { className?: string }) {
  return <BoxIcon size={20} className={className} />;
}

function EditProductsIcon({ className }: { className?: string }) {
  return <SquarePenIcon size={20} className={className} />;
}

function UploadProductsIcon({ className }: { className?: string }) {
  return <UploadIcon size={20} className={className} />;
}

function UsersIcon({ className }: { className?: string }) {
  return <Users animateOnHover className={className} />;
}

function ReportsIcon({ className }: { className?: string }) {
  return <ChartLine animateOnHover className={className} />;
}

function HSTIcon({ className }: { className?: string }) {
  return <HandCoinsIcon size={20} className={className} />;
}

function ImeiLookupIcon({ className }: { className?: string }) {
  return <ScanLine className={className} />;
}

function AppSettingsIcon({ className }: { className?: string }) {
  return <SettingsIcon size={20} className={className} />;
}

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  /** Roles that can see this item. Omit to show to all roles. */
  allowedRoles?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: DashboardIcon, path: "/dashboard" },
  { label: "Inventory", icon: InventoryIcon, path: "/inventory" },
  {
    label: "Edit Products",
    icon: EditProductsIcon,
    path: "/products",
    allowedRoles: ["owner", "manager", "inventory_admin"],
  },
  {
    label: "Upload Products",
    icon: UploadProductsIcon,
    path: "/upload-products",
    allowedRoles: ["owner", "manager", "inventory_admin"],
  },
  { label: "Orders", icon: ShoppingBag, path: "/orders", allowedRoles: ["owner", "manager"] },
  { label: "Users", icon: UsersIcon, path: "/users", allowedRoles: ["owner"] },
  { label: "Alerts", icon: Bell, path: "/alerts" },
  { label: "Reports", icon: ReportsIcon, path: "/reports" },
  { label: "IMEI Lookup", icon: ImeiLookupIcon, path: "/imei-lookup" },
  { label: "HST", icon: HSTIcon, path: "/hst", allowedRoles: ["owner", "manager"] },
  { label: "Settings", icon: AppSettingsIcon, path: "/settings", allowedRoles: ["owner"] },
];

export function AppSidebar({ open, collapsed, onClose, onToggleCollapse }: AppSidebarProps) {
  const { role } = useCompany();
  const { companyRoute } = useCompanyRoute();
  const { pushNotificationsEnabled } = useNotificationSettings();
  const { unreadCount } = useNotificationsFeed();
  const alertCount = useMemo(
    () => (pushNotificationsEnabled ? unreadCount : 0),
    [pushNotificationsEnabled, unreadCount],
  );

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(role),
  );

  return (
    <>
      {/* Mobile Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-dvh bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
          "lg:sticky lg:top-0 lg:h-dvh",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
            {!collapsed && <span className="font-semibold text-sidebar-foreground">Menu</span>}
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
              <X className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="hidden lg:flex"
            >
              <ChevronLeft
                className={cn("h-5 w-5 transition-transform", collapsed && "rotate-180")}
              />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            <TooltipProvider delayDuration={100}>
              {visibleItems.map((item) => {
                const href = companyRoute(item.path);
                const isAlerts = item.path === "/alerts";
                const showBadge = isAlerts && alertCount > 0;

                return (
                  <Tooltip key={item.path} disableHoverableContent>
                    <TooltipTrigger asChild>
                      <NavLink
                        href={href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          collapsed && "justify-center px-2",
                        )}
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        onClick={onClose}
                      >
                        <div className="relative flex-shrink-0">
                          <item.icon className="h-5 w-5" />
                          {showBadge && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                              {alertCount > 99 ? "99+" : alertCount}
                            </span>
                          )}
                        </div>
                        {!collapsed && <span className="text-sm">{item.label}</span>}
                        {!collapsed && showBadge && (
                          <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                            {alertCount > 99 ? "99+" : alertCount}
                          </span>
                        )}
                      </NavLink>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                        {showBadge && ` (${alertCount})`}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </nav>
        </div>
      </aside>
    </>
  );
}
