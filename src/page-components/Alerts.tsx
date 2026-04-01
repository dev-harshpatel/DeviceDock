"use client";

import { useMemo, useState } from "react";
import { Bell, CheckCircle, Clock, Search } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Loader } from "@/components/common/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotificationSettings } from "@/contexts/NotificationSettingsContext";
import { useNotificationsFeed } from "@/hooks/use-notifications-feed";
import type { InAppNotificationItem } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

const alertStyles: Record<InAppNotificationItem["severity"], { bg: string; icon: string }> = {
  critical: {
    bg: "bg-destructive/5 border-destructive/20",
    icon: "bg-destructive/10 text-destructive",
  },
  warning: {
    bg: "bg-warning/5 border-warning/20",
    icon: "bg-warning/10 text-warning",
  },
  info: {
    bg: "bg-primary/5 border-primary/20",
    icon: "bg-primary/10 text-primary",
  },
};

export default function Alerts() {
  const { isLoading, notifications } = useNotificationsFeed();
  const { markAsRead, markAllAsRead, readIds } = useNotificationSettings();
  const [activeTab, setActiveTab] = useState<
    "all" | "inventory" | "invitation" | "manual_sale" | "stock"
  >("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const allAlerts = useMemo(
    () =>
      notifications.map((notification) => ({
        ...notification,
        read: readIds.has(notification.id),
      })),
    [notifications, readIds],
  );
  const filteredAlerts = useMemo(
    () =>
      allAlerts.filter((alert) => {
        if (showUnreadOnly && alert.read) return false;
        if (activeTab !== "all" && alert.type !== activeTab) return false;
        if (!search.trim()) return true;
        const query = search.trim().toLowerCase();
        return (
          alert.title.toLowerCase().includes(query) ||
          alert.description.toLowerCase().includes(query)
        );
      }),
    [activeTab, allAlerts, search, showUnreadOnly],
  );
  const unreadCount = useMemo(() => allAlerts.filter((alert) => !alert.read).length, [allAlerts]);

  const handleMarkAllAsRead = () => {
    markAllAsRead(allAlerts.map((a) => a.id));
  };

  if (isLoading) {
    return <Loader size="lg" text="Loading alerts..." />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Sticky header — does not scroll */}
      <div className="flex-shrink-0 space-y-4 pb-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Alerts</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {allAlerts.length === 0
                ? "No notifications yet"
                : `${unreadCount} unread · ${allAlerts.length} total notifications`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-3">
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "all" | "inventory" | "invitation" | "manual_sale" | "stock")
            }
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="invitation">Invitations</TabsTrigger>
              <TabsTrigger value="manual_sale">Manual sales</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search notifications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card focus-visible:ring-inset focus-visible:ring-offset-0"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={showUnreadOnly}
                onCheckedChange={setShowUnreadOnly}
                id="unread-filter"
              />
              <label
                htmlFor="unread-filter"
                className="text-sm text-muted-foreground cursor-pointer select-none whitespace-nowrap"
              >
                Unread only
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable alerts list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
        {filteredAlerts.length === 0 ? (
          <EmptyState
            title={showUnreadOnly ? "No unread alerts" : "No notifications"}
            description={
              showUnreadOnly ? "You're all caught up!" : "No notifications match this filter."
            }
          />
        ) : (
          filteredAlerts.map((alert) => {
            const styles = alertStyles[alert.severity];
            return (
              <div
                key={alert.id}
                onClick={() => !alert.read && markAsRead(alert.id)}
                className={cn(
                  "p-3 rounded-lg border transition-colors",
                  styles.bg,
                  !alert.read &&
                    "ring-1 ring-inset ring-primary/20 cursor-pointer hover:ring-primary/40",
                  alert.read && "opacity-60",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-1.5 rounded-lg flex-shrink-0", styles.icon)}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <h4 className="font-medium text-foreground shrink-0">{alert.title}</h4>
                        <span className="text-muted-foreground shrink-0">·</span>
                        <p className="text-sm text-muted-foreground truncate">
                          {alert.description}
                        </p>
                        {!alert.read && (
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse-soft shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Live</span>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                      {alert.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
