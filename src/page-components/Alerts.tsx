"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Loader } from "@/components/common/Loader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useInventory } from "@/contexts/InventoryContext";
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

const ALERT_LABELS: Record<AlertSeverity, { title: string; description: (qty: number) => string }> = {
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

function deriveAlerts(inventory: ReturnType<typeof useInventory>["inventory"]): StockAlert[] {
  const alerts: StockAlert[] = [];

  for (const item of inventory) {
    const status = getStockStatus(item.quantity);
    if (status === "in-stock") continue;

    const severity: AlertSeverity =
      status === "out-of-stock" ? "out-of-stock" :
      status === "critical" ? "critical" :
      "warning";

    const label = ALERT_LABELS[severity];
    alerts.push({
      id: item.id,
      severity,
      title: label.title,
      description: label.description(item.quantity),
      device: `${item.brand} ${item.deviceName} — ${item.storage} (${item.grade})`,
      read: false,
    });
  }

  // Sort by severity: out-of-stock → critical → warning
  return alerts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

export default function Alerts() {
  const { inventory, isLoading } = useInventory();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const allAlerts = useMemo(
    () =>
      deriveAlerts(inventory).map((alert) => ({
        ...alert,
        read: readIds.has(alert.id),
      })),
    [inventory, readIds],
  );

  const filteredAlerts = showUnreadOnly
    ? allAlerts.filter((a) => !a.read)
    : allAlerts;

  const unreadCount = allAlerts.filter((a) => !a.read).length;

  const markAsRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  };

  const markAllAsRead = () => {
    setReadIds(new Set(allAlerts.map((a) => a.id)));
  };

  if (isLoading) {
    return <Loader size="lg" text="Loading alerts..." />;
  }

  return (
    <div className="space-y-6">
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
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={showUnreadOnly}
            onCheckedChange={setShowUnreadOnly}
            id="unread-filter"
          />
          <label
            htmlFor="unread-filter"
            className="text-sm text-foreground cursor-pointer"
          >
            Show unread only
          </label>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <EmptyState
            title={showUnreadOnly ? "No unread alerts" : "No stock alerts"}
            description={
              showUnreadOnly
                ? "You're all caught up!"
                : "All inventory items are well-stocked."
            }
          />
        ) : (
          filteredAlerts.map((alert) => {
            const styles = alertStyles[alert.severity];
            return (
              <div
                key={alert.id}
                className={cn(
                  "p-4 rounded-lg border transition-colors",
                  styles.bg,
                  !alert.read && "ring-1 ring-inset ring-primary/20",
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn("p-2 rounded-lg flex-shrink-0", styles.icon)}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground">{alert.title}</h4>
                          {!alert.read && (
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-soft" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        <p className="text-sm font-medium text-foreground mt-1">{alert.device}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Live</span>
                      </div>
                    </div>
                    {!alert.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 px-2 text-xs"
                        onClick={() => markAsRead(alert.id)}
                      >
                        Mark as read
                      </Button>
                    )}
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
