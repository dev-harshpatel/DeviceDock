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
import { Bell, Building2, Loader2, Palette, Save, Upload, User, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client/browser";
import {
  COMPANY_LOGOS_BUCKET,
  getStorageObjectPathFromPublicUrl,
} from "@/lib/supabase/storage-path";
import { useCompany } from "@/contexts/CompanyContext";
import { useNotificationSettings } from "@/contexts/NotificationSettingsContext";
import { ONTARIO_TIMEZONE } from "@/lib/constants";
import { LogoCropModal } from "@/components/modals/LogoCropModal";

interface CompanySettingsForm {
  companyName: string;
  companyAddress: string;
  hstNumber: string;
  logoUrl: string | null;
}

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { company, companyId } = useCompany();

  const {
    pushNotificationsEnabled,
    lowStockThreshold,
    criticalStockThreshold,
    isLoaded: notifLoaded,
    updateSettings,
  } = useNotificationSettings();

  const [profileSettings, setProfileSettings] = useState({
    email: "",
    currency: "CAD",
    timezone: ONTARIO_TIMEZONE,
  });

  const [companyForm, setCompanyForm] = useState<CompanySettingsForm>({
    companyName: company.name,
    companyAddress: "",
    hstNumber: "",
    logoUrl: null,
  });

  const [notifSettings, setNotifSettings] = useState({
    pushNotifications: true,
    lowStockThreshold: 5,
    criticalStockThreshold: 2,
  });

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  /** Browser `<img>` cannot send auth; private buckets need a signed URL. */
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  /** Object-URL of the raw file selected by the user; drives the crop modal. */
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingNotifSettings, setIsSavingNotifSettings] = useState(false);

  // Load current user's email
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setProfileSettings((s) => ({ ...s, email: data.user!.email! }));
      }
    });
  }, []);

  // Load company settings row (company_id scoped)
  useEffect(() => {
    if (!companyId) return;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("company_settings")
          .select("company_name, company_address, hst_number, logo_url")
          .eq("company_id", companyId)
          .maybeSingle();

        const row = data as {
          company_name: string | null;
          company_address: string | null;
          hst_number: string | null;
          logo_url: string | null;
        } | null;

        setCompanyForm({
          // Fall back to companies.name so the field is never blank on first load
          companyName: row?.company_name || company.name,
          companyAddress: row?.company_address || "",
          hstNumber: row?.hst_number || "",
          logoUrl: row?.logo_url ?? null,
        });
      } catch {
        // Leave form pre-filled with company.name on error
      }
    };

    load();
  }, [companyId, company.name]);

  // Resolve a display URL for the logo (signed URL works for private buckets).
  useEffect(() => {
    if (!companyForm.logoUrl) {
      setLogoPreviewUrl(null);
      return;
    }

    setLogoPreviewUrl(null);

    const path = getStorageObjectPathFromPublicUrl(companyForm.logoUrl, COMPANY_LOGOS_BUCKET);

    if (!path) {
      setLogoPreviewUrl(companyForm.logoUrl);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase.storage
        .from(COMPANY_LOGOS_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24);

      if (cancelled) return;

      if (!error && data?.signedUrl) {
        setLogoPreviewUrl(data.signedUrl);
        return;
      }

      setLogoPreviewUrl(companyForm.logoUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyForm.logoUrl]);

  // Sync notification/inventory form from context once loaded
  useEffect(() => {
    if (notifLoaded) {
      setNotifSettings({
        pushNotifications: pushNotificationsEnabled,
        lowStockThreshold,
        criticalStockThreshold,
      });
    }
  }, [notifLoaded, pushNotificationsEnabled, lowStockThreshold, criticalStockThreshold]);

  const handleClickLogoUpload = () => {
    if (companyForm.logoUrl) {
      toast.error(TOAST_MESSAGES.SETTINGS_LOGO_REMOVE_BEFORE_UPLOAD);
      return;
    }
    fileInputRef.current?.click();
  };

  /**
   * Step 1 — file selected: validate then open the crop modal instead of
   * uploading directly. SVGs are vector so they skip cropping.
   */
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!companyId) {
      toast.error("Company not loaded. Please refresh and try again.");
      return;
    }

    if (companyForm.logoUrl) {
      toast.error(TOAST_MESSAGES.SETTINGS_LOGO_REMOVE_BEFORE_UPLOAD);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error(TOAST_MESSAGES.SETTINGS_IMAGE_REQUIRED);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }

    // SVGs are vector — skip canvas crop and upload directly.
    if (file.type === "image/svg+xml") {
      void handleCroppedUpload(file);
      return;
    }

    // Raster images — open the crop modal.
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  };

  /**
   * Step 2 — user confirmed crop (or SVG bypassed): upload to Supabase Storage
   * and persist the URL.
   */
  const handleCroppedUpload = async (blob: Blob | File) => {
    if (!companyId) return;
    setIsUploadingLogo(true);
    // Release the object-URL once we have the blob.
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }

    try {
      const fileName = `${companyId}/logo-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from(COMPANY_LOGOS_BUCKET)
        .upload(fileName, blob, { contentType: "image/png", cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(COMPANY_LOGOS_BUCKET).getPublicUrl(fileName);

      const { error: upsertError } = await supabase
        .from("company_settings")
        .upsert({ company_id: companyId, logo_url: urlData.publicUrl } as never, {
          onConflict: "company_id",
        });

      if (upsertError) throw upsertError;

      setCompanyForm((prev) => ({ ...prev, logoUrl: urlData.publicUrl }));
      toast.success(TOAST_MESSAGES.SETTINGS_LOGO_UPLOADED);
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  /** Discard the crop modal without uploading. */
  const handleCropCancel = () => {
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  };

  const handleRemoveLogo = async () => {
    if (!companyForm.logoUrl || !companyId) return;

    setIsUploadingLogo(true);

    try {
      const logoPath = getStorageObjectPathFromPublicUrl(companyForm.logoUrl, COMPANY_LOGOS_BUCKET);
      if (logoPath) {
        await supabase.storage.from(COMPANY_LOGOS_BUCKET).remove([logoPath]);
      }

      const { error } = await supabase
        .from("company_settings")
        .upsert({ company_id: companyId, logo_url: null } as never, { onConflict: "company_id" });

      if (error) throw error;

      setCompanyForm((prev) => ({ ...prev, logoUrl: null }));
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
      const { error } = await supabase.from("company_settings").upsert(
        {
          company_id: companyId,
          company_name: companyForm.companyName,
          company_address: companyForm.companyAddress,
          hst_number: companyForm.hstNumber,
        } as never,
        { onConflict: "company_id" },
      );

      if (error) throw error;

      toast.success("Company settings saved successfully");
    } catch (error) {
      console.error("Error saving company settings:", error);
      toast.error(TOAST_MESSAGES.SETTINGS_COMPANY_SAVE_FAILED);
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleSaveNotifSettings = async () => {
    setIsSavingNotifSettings(true);

    try {
      const { error } = await supabase.from("company_settings").upsert(
        {
          company_id: companyId,
          push_notifications_enabled: notifSettings.pushNotifications,
          low_stock_threshold: notifSettings.lowStockThreshold,
          critical_stock_threshold: notifSettings.criticalStockThreshold,
        } as never,
        { onConflict: "company_id" },
      );

      if (error) throw error;

      // Propagate to context so the sidebar badge and Alerts page update immediately
      updateSettings({
        pushNotificationsEnabled: notifSettings.pushNotifications,
        lowStockThreshold: notifSettings.lowStockThreshold,
        criticalStockThreshold: notifSettings.criticalStockThreshold,
      });

      toast.success(TOAST_MESSAGES.SETTINGS_SAVED);
    } catch (error) {
      console.error("Error saving notification settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSavingNotifSettings(false);
    }
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
              <h3 className="font-semibold text-foreground">Company Information</h3>
              <p className="text-sm text-muted-foreground">Details displayed on invoices</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Logo Upload */}
            <div className="grid gap-2">
              <Label htmlFor="logo">Company Logo</Label>
              <div className="flex items-start gap-4">
                {companyForm.logoUrl ? (
                  <div className="relative">
                    {!logoPreviewUrl ? (
                      <div className="w-40 h-16 border border-border rounded-lg flex items-center justify-center bg-muted/50">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <img
                        src={logoPreviewUrl}
                        alt="Company Logo"
                        className="w-40 h-16 object-contain border border-border rounded-lg bg-background p-1"
                      />
                    )}
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
                  <div className="w-40 h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClickLogoUpload}
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
                    PNG, JPG or SVG · max 5 MB · landscape or square logos work best on invoices
                    (avoid tall portrait images)
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
                value={companyForm.companyName}
                onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                className="bg-background"
              />
            </div>

            {/* Company Address */}
            <div className="grid gap-2">
              <Label htmlFor="companyAddress">Company Address</Label>
              <Textarea
                id="companyAddress"
                value={companyForm.companyAddress}
                onChange={(e) => setCompanyForm({ ...companyForm, companyAddress: e.target.value })}
                className="bg-background min-h-[80px]"
              />
            </div>

            {/* HST Number */}
            <div className="grid gap-2">
              <Label htmlFor="hstNumber">HST Number</Label>
              <Input
                id="hstNumber"
                value={companyForm.hstNumber}
                onChange={(e) => setCompanyForm({ ...companyForm, hstNumber: e.target.value })}
                className="bg-background"
                placeholder="Optional"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveCompanySettings} disabled={isSavingCompany}>
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
                <p className="text-sm font-medium text-foreground">Push Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Show stock alerts in the sidebar bell icon
                </p>
              </div>
              <Switch
                checked={notifSettings.pushNotifications}
                onCheckedChange={(v) =>
                  setNotifSettings({ ...notifSettings, pushNotifications: v })
                }
              />
            </div>
          </div>
        </div>

        {/* Inventory Thresholds */}
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

        {/* Save Notifications + Thresholds */}
        <div className="flex justify-end">
          <Button onClick={handleSaveNotifSettings} disabled={isSavingNotifSettings}>
            {isSavingNotifSettings ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Logo crop modal — shown after a raster image is selected */}
      {cropSrc && (
        <LogoCropModal
          open={Boolean(cropSrc)}
          onOpenChange={(open) => {
            if (!open) handleCropCancel();
          }}
          imageSrc={cropSrc}
          onConfirm={handleCroppedUpload}
        />
      )}
    </div>
  );
}
