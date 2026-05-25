import React from "react";
import { Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NotifSettings {
  pushNotifications: boolean;
  lowStockThreshold: number;
  criticalStockThreshold: number;
}

interface InventoryThresholdSectionProps {
  notifSettings: NotifSettings;
  setNotifSettings: React.Dispatch<React.SetStateAction<NotifSettings>>;
}

export function InventoryThresholdSection({
  notifSettings,
  setNotifSettings,
}: InventoryThresholdSectionProps) {
  return (
    <div className="bg-card rounded-lg border border-border shadow-soft p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-accent text-accent-foreground">
          <Palette className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Inventory</h3>
          <p className="text-sm text-muted-foreground">Stock alert thresholds</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="low-stock">Low Stock Threshold</Label>
          <Input
            id="low-stock"
            type="number"
            min={1}
            value={notifSettings.lowStockThreshold || ""}
            onChange={(e) => {
              const val = e.target.value;
              setNotifSettings({
                ...notifSettings,
                lowStockThreshold: val === "" ? 0 : parseInt(val),
              });
            }}
            onBlur={() => {
              if (!notifSettings.lowStockThreshold || notifSettings.lowStockThreshold < 1) {
                setNotifSettings({ ...notifSettings, lowStockThreshold: 1 });
              }
            }}
            className="bg-background"
          />
          <p className="text-xs text-muted-foreground">Show warning below this quantity</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="critical-stock">Critical Stock Threshold</Label>
          <Input
            id="critical-stock"
            type="number"
            min={1}
            value={notifSettings.criticalStockThreshold || ""}
            onChange={(e) => {
              const val = e.target.value;
              setNotifSettings({
                ...notifSettings,
                criticalStockThreshold: val === "" ? 0 : parseInt(val),
              });
            }}
            onBlur={() => {
              if (
                !notifSettings.criticalStockThreshold ||
                notifSettings.criticalStockThreshold < 1
              ) {
                setNotifSettings({ ...notifSettings, criticalStockThreshold: 1 });
              }
            }}
            className="bg-background"
          />
          <p className="text-xs text-muted-foreground">Show critical below this quantity</p>
        </div>
      </div>
    </div>
  );
}
