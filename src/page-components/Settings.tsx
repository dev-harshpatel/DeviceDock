"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import {
  Bell,
  Building2,
  Loader2,
  Palette,
  Save,
  Shield,
  Upload,
  User,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client/browser";
import {
  ONTARIO_TIMEZONE,
  DEFAULT_COMPANY_NAME,
  DEFAULT_COMPANY_ADDRESS,
} from "@/lib/constants";

interface CompanySettings {
  id: string;
  companyName: string;
  companyAddress: string;
  hstNumber: string;
  logoUrl: string | null;
}

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState({
    email: "",
    currency: "CAD",
    timezone: ONTARIO_TIMEZONE,
    lowStockThreshold: 5,
    criticalStockThreshold: 2,
    emailAlerts: true,
    pushNotifications: true,
    dailyDigest: false,
    autoRefreshInterval: 5,
    twoFactorAuth: false,
  });

  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    id: "",
    companyName: DEFAULT_COMPANY_NAME,
    companyAddress: DEFAULT_COMPANY_ADDRESS,
    hstNumber: "",
    logoUrl: null,
  });

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  // Load current user's email
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setSettings((s) => ({ ...s, email: data.user!.email! }));
      }
    });
  }, []);

  // Load company settings
  useEffect(() => {
    const loadCompanySettings = async () => {
      try {
        const { data, error } = await supabase
          .from("company_settings")
          .select("id, company_name, company_address, hst_number, logo_url")
          .single();

        if (!error && data) {
          const companyData = data as {
            id: string;
            company_name: string | null;
            company_address: string | null;
            hst_number: string | null;
            logo_url: string | null;
          };

          setCompanySettings({
            id: companyData.id,
            companyName: companyData.company_name || "",
            companyAddress: companyData.company_address || "",
            hstNumber: companyData.hst_number || "",
            logoUrl: companyData.logo_url,
          });
        }
      } catch (error) {
        console.error("Error loading company settings:", error);
      }
    };

    loadCompanySettings();
  }, []);

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(TOAST_MESSAGES.SETTINGS_IMAGE_REQUIRED);
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(TOAST_MESSAGES.SETTINGS_IMAGE_SIZE);
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Delete old logo if exists
      if (companySettings.logoUrl) {
        const oldPath = companySettings.logoUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("company-logos").remove([oldPath]);
        }
      }

      // Upload new logo
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(fileName);

      // Update company settings with new logo URL
      const { error: updateError } = await supabase
        .from("company_settings")
        .update({ logo_url: urlData.publicUrl } as never)
        .eq("id", companySettings.id);

      if (updateError) {
        throw updateError;
      }

      setCompanySettings({
        ...companySettings,
        logoUrl: urlData.publicUrl,
      });

      toast.success(TOAST_MESSAGES.SETTINGS_LOGO_UPLOADED);
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!companySettings.logoUrl) return;

    setIsUploadingLogo(true);

    try {
      // Delete logo from storage
      const logoPath = companySettings.logoUrl.split("/").pop();
      if (logoPath) {
        await supabase.storage.from("company-logos").remove([logoPath]);
      }

      // Update company settings
      const { error } = await supabase
        .from("company_settings")
        .update({ logo_url: null } as never)
        .eq("id", companySettings.id);

      if (error) {
        throw error;
      }

      setCompanySettings({
        ...companySettings,
        logoUrl: null,
      });

      toast.success(TOAST_MESSAGES.SETTINGS_LOGO_REMOVED);
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error(TOAST_MESSAGES.SETTINGS_LOGO_REMOVE_FAILED);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveCompanySettings = async () => {
    setIsSavingCompany(true);

    try {
      const { error } = await supabase
        .from("company_settings")
        .update({
          company_name: companySettings.companyName,
          company_address: companySettings.companyAddress,
          hst_number: companySettings.hstNumber,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", companySettings.id);

      if (error) {
        throw error;
      }

      toast.success("Company settings saved successfully");
    } catch (error) {
      console.error("Error saving company settings:", error);
      toast.error(TOAST_MESSAGES.SETTINGS_COMPANY_SAVE_FAILED);
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleSave = () => {
    toast.success(TOAST_MESSAGES.SETTINGS_SAVED);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-6 max-w-3xl w-full pb-6">
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account and application preferences
          </p>
        </div>

        {/* Company Information Section */}
        <div className="bg-card rounded-lg border border-border shadow-soft p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Company Information
              </h3>
              <p className="text-sm text-muted-foreground">
                Details displayed on invoices
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Logo Upload */}
            <div className="grid gap-2">
              <Label htmlFor="logo">Company Logo</Label>
              <div className="flex items-start gap-4">
                {companySettings.logoUrl ? (
                  <div className="relative">
                    <img
                      src={companySettings.logoUrl}
                      alt="Company Logo"
                      className="w-24 h-24 object-contain border border-border rounded-lg"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="w-full sm:w-auto"
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Recommended: PNG or JPG, max 2MB
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Company Name */}
            <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companySettings.companyName}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    companyName: e.target.value,
                  })
                }
                className="bg-background"
              />
            </div>

            {/* Company Address */}
            <div className="grid gap-2">
              <Label htmlFor="companyAddress">Company Address</Label>
              <Textarea
                id="companyAddress"
                value={companySettings.companyAddress}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    companyAddress: e.target.value,
                  })
                }
                className="bg-background min-h-[80px]"
              />
            </div>

            {/* HST Number */}
            <div className="grid gap-2">
              <Label htmlFor="hstNumber">HST Number</Label>
              <Input
                id="hstNumber"
                value={companySettings.hstNumber}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    hstNumber: e.target.value,
                  })
                }
                className="bg-background"
                placeholder="Optional"
              />
            </div>

            {/* Save Company Settings Button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveCompanySettings}
                disabled={isSavingCompany}
              >
                {isSavingCompany ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Company Info
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Profile Section */}
        <div className="bg-card rounded-lg border border-border shadow-soft p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Profile</h3>
              <p className="text-sm text-muted-foreground">
                Your account details
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) =>
                  setSettings({ ...settings, email: e.target.value })
                }
                className="bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select
                  value={settings.currency}
                  onValueChange={(v) =>
                    setSettings({ ...settings, currency: v })
                  }
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
                  value={settings.timezone}
                  onValueChange={(v) =>
                    setSettings({ ...settings, timezone: v })
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value={ONTARIO_TIMEZONE}>
                      Eastern (Toronto)
                    </SelectItem>
                    <SelectItem value="America/Vancouver">
                      Pacific (Vancouver)
                    </SelectItem>
                    <SelectItem value="America/Chicago">
                      Central (Chicago)
                    </SelectItem>
                    <SelectItem value="Europe/London">GMT (London)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
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
                <p className="text-sm font-medium text-foreground">
                  Email Alerts
                </p>
                <p className="text-xs text-muted-foreground">
                  Get notified via email
                </p>
              </div>
              <Switch
                checked={settings.emailAlerts}
                onCheckedChange={(v) =>
                  setSettings({ ...settings, emailAlerts: v })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Push Notifications
                </p>
                <p className="text-xs text-muted-foreground">
                  Browser notifications
                </p>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(v) =>
                  setSettings({ ...settings, pushNotifications: v })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Daily Digest
                </p>
                <p className="text-xs text-muted-foreground">
                  Receive a daily summary
                </p>
              </div>
              <Switch
                checked={settings.dailyDigest}
                onCheckedChange={(v) =>
                  setSettings({ ...settings, dailyDigest: v })
                }
              />
            </div>
          </div>
        </div>

        {/* Inventory Settings */}
        <div className="bg-card rounded-lg border border-border shadow-soft p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-accent text-accent-foreground">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Inventory</h3>
              <p className="text-sm text-muted-foreground">
                Stock thresholds and display
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="low-stock">Low Stock Threshold</Label>
              <Input
                id="low-stock"
                type="number"
                value={settings.lowStockThreshold || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings({
                    ...settings,
                    lowStockThreshold: val === "" ? 0 : parseInt(val),
                  });
                }}
                onBlur={() => {
                  if (!settings.lowStockThreshold || settings.lowStockThreshold < 1) {
                    setSettings({ ...settings, lowStockThreshold: 1 });
                  }
                }}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Show warning below this quantity
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="critical-stock">Critical Stock Threshold</Label>
              <Input
                id="critical-stock"
                type="number"
                value={settings.criticalStockThreshold || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings({
                    ...settings,
                    criticalStockThreshold: val === "" ? 0 : parseInt(val),
                  });
                }}
                onBlur={() => {
                  if (!settings.criticalStockThreshold || settings.criticalStockThreshold < 1) {
                    setSettings({ ...settings, criticalStockThreshold: 1 });
                  }
                }}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Show critical below this quantity
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="refresh">Auto-Refresh Interval (minutes)</Label>
              <Input
                id="refresh"
                type="number"
                value={settings.autoRefreshInterval || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings({
                    ...settings,
                    autoRefreshInterval: val === "" ? 0 : parseInt(val),
                  });
                }}
                onBlur={() => {
                  if (!settings.autoRefreshInterval || settings.autoRefreshInterval < 1) {
                    setSettings({ ...settings, autoRefreshInterval: 1 });
                  }
                }}
                className="bg-background"
              />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-card rounded-lg border border-border shadow-soft p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-success/10 text-success">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Security</h3>
              <p className="text-sm text-muted-foreground">
                Account security settings
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Two-Factor Authentication
              </p>
              <p className="text-xs text-muted-foreground">
                Add an extra layer of security
              </p>
            </div>
            <Switch
              checked={settings.twoFactorAuth}
              onCheckedChange={(v) =>
                setSettings({ ...settings, twoFactorAuth: v })
              }
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
