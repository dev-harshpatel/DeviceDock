import React from "react";
import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface NotifSettings {
  pushNotifications: boolean;
  lowStockThreshold: number;
  criticalStockThreshold: number;
}

interface NotificationSettingsSectionProps {
  notifSettings: NotifSettings;
  setNotifSettings: React.Dispatch<React.SetStateAction<NotifSettings>>;
}

export function NotificationSettingsSection({
  notifSettings,
  setNotifSettings,
}: NotificationSettingsSectionProps) {
  return (
    <div className="bg-card rounded-lg border border-border shadow-soft p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-warning/10 text-warning">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Notifications</h3>
          <p className="text-sm text-muted-foreground">Alert preferences</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Push Notifications</p>
            <p className="text-xs text-muted-foreground">
              Show stock alerts in the sidebar bell icon
            </p>
          </div>
          <Switch
            checked={notifSettings.pushNotifications}
            onCheckedChange={(v) => setNotifSettings({ ...notifSettings, pushNotifications: v })}
          />
        </div>
      </div>
    </div>
  );
}
