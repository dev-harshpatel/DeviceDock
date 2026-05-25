import React from "react";
import { User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ONTARIO_TIMEZONE } from "@/lib/constants";

interface ProfileSettings {
  email: string;
  currency: string;
  timezone: string;
}

interface ProfileSettingsSectionProps {
  profileSettings: ProfileSettings;
  setProfileSettings: React.Dispatch<React.SetStateAction<ProfileSettings>>;
}

export function ProfileSettingsSection({
  profileSettings,
  setProfileSettings,
}: ProfileSettingsSectionProps) {
  return (
    <div className="bg-card rounded-lg border border-border shadow-soft p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Profile</h3>
          <p className="text-sm text-muted-foreground">Your account details</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={profileSettings.email}
            readOnly
            className="bg-background text-muted-foreground cursor-default"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Currency</Label>
            <Select
              value={profileSettings.currency}
              onValueChange={(v) => setProfileSettings({ ...profileSettings, currency: v })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="CAD">CAD ($)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Timezone</Label>
            <Select
              value={profileSettings.timezone}
              onValueChange={(v) => setProfileSettings({ ...profileSettings, timezone: v })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value={ONTARIO_TIMEZONE}>Eastern (Toronto)</SelectItem>
                <SelectItem value="America/Vancouver">Pacific (Vancouver)</SelectItem>
                <SelectItem value="America/Chicago">Central (Chicago)</SelectItem>
                <SelectItem value="Europe/London">GMT (London)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
