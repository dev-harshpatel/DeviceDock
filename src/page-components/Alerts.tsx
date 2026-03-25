"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Search } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Loader } from "@/components/common/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useInventory } from "@/contexts/InventoryContext";
import { useNotificationSettings } from "@/contexts/NotificationSettingsContext";
import { getStockStatus } from "@/data/inventory";
import { cn } from "@/lib/utils";

type AlertSeverity = "critical" | "warning" | "out-of-stock";

interface StockAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  device: string;
  read: boolean;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  "out-of-stock": 0,
  critical: 1,
  warning: 2,
};

const alertStyles: Record<AlertSeverity, { bg: string; icon: string; badge: string }> = {
  "out-of-stock": {
    bg: "bg-destructive/5 border-destructive/20",
    icon: "bg-destructive/10 text-destructive",
    badge: "bg-destructive text-destructive-foreground",
  },
  critical: {
    bg: "bg-destructive/5 border-destructive/20",
    icon: "bg-destructive/10 text-destructive",
    badge: "bg-destructive text-destructive-foreground",
  },
  warning: {
    bg: "bg-warning/5 border-warning/20",
    icon: "bg-warning/10 text-warning",
    badge: "bg-warning text-warning-foreground",
  },
};

const ALERT_LABELS: Record<AlertSeverity, { title: string; description: (qty: number) => string }> =
  {
    "out-of-stock": {
      title: "Out of Stock",
      description: () => "No units remaining — item is out of stock",
    },
    critical: {
      title: "Critical Stock Level",
      description: (qty) => `Only ${qty} unit${qty === 1 ? "" : "s"} remaining`,
    },
    warning: {
      title: "Low Stock Warning",
      description: (qty) => `${qty} units remaining — consider restocking`,
    },
  };

function deriveAlerts(
  inventory: ReturnType<typeof useInventory>["inventory"],
  lowStockThreshold: number,
  criticalStockThreshold: number,
): Omit<StockAlert, "read">[] {
  const alerts: Omit<StockAlert, "read">[] = [];

  for (const item of inventory) {
    const status = getStockStatus(item.quantity, lowStockThreshold, criticalStockThreshold);
    if (status === "in-stock") continue;

    const severity: AlertSeverity =
      status === "out-of-stock" ? "out-of-stock" : status === "critical" ? "critical" : "warning";

    const label = ALERT_LABELS[severity];
    alerts.push({
      id: item.id,
      severity,
      title: label.title,
      description: label.description(item.quantity),
      device: `${item.brand} ${item.deviceName} — ${item.storage} (${item.grade})`,
    });
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export default function Alerts() {
  const { inventory, isLoading } = useInventory();
  const { lowStockThreshold, criticalStockThreshold, readIds, markAsRead, markAllAsRead } =
    useNotificationSettings();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");

  const allAlerts = useMemo(
    () =>
      deriveAlerts(inventory, lowStockThreshold, criticalStockThreshold).map((alert) => ({
        ...alert,
        read: readIds.has(alert.id),
      })),
    [inventory, lowStockThreshold, criticalStockThreshold, readIds],
  );

  const filteredAlerts = allAlerts.filter((a) => {
    if (showUnreadOnly && a.read) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.device.toLowerCase().includes(q) || a.title.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadCount = allAlerts.filter((a) => !a.read).length;

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
                ? "All items are well-stocked"
                : `${unreadCount} unread · ${allAlerts.length} total stock alert${allAlerts.length === 1 ? "" : "s"}`}
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
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by device or alert type…"
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

      {/* Scrollable alerts list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
        {filteredAlerts.length === 0 ? (
          <EmptyState
            title={showUnreadOnly ? "No unread alerts" : "No stock alerts"}
            description={
              showUnreadOnly ? "You're all caught up!" : "All inventory items are well-stocked."
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
                    <AlertTriangle className="h-4 w-4" />
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
                      {alert.device}
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
