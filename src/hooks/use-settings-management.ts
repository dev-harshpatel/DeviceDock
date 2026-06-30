"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useCompany } from "@/contexts/CompanyContext";
import { useNotificationSettings } from "@/contexts/NotificationSettingsContext";
import { ONTARIO_TIMEZONE } from "@/lib/constants";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { supabase } from "@/lib/supabase/client/browser";
import {
  fetchCompanySettings,
  upsertCompanyLogo,
  upsertCompanyProfile,
  upsertCompanyNotificationSettings,
} from "@/lib/supabase/queries";
import {
  COMPANY_LOGOS_BUCKET,
  getStorageObjectPathFromPublicUrl,
} from "@/lib/supabase/storage-path";

export interface CompanySettingsForm {
  companyName: string;
  companyAddress: string;
  hstNumber: string;
  logoUrl: string | null;
}

export function useSettingsManagement() {
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
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingNotifSettings, setIsSavingNotifSettings] = useState(false);

  // Load current user's email
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user?.email) {
        setProfileSettings((s) => ({ ...s, email: data.user!.email! }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load company settings row (company_id scoped)
  useEffect(() => {
    if (!companyId) return;

    const load = async () => {
      try {
        const row = await fetchCompanySettings(companyId);

        setCompanyForm({
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

    if (file.type === "image/svg+xml") {
      void handleCroppedUpload(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  };

  const handleCroppedUpload = async (blob: Blob | File) => {
    if (!companyId) return;
    setIsUploadingLogo(true);
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

      await upsertCompanyLogo(companyId, urlData.publicUrl);

      setCompanyForm((prev) => ({ ...prev, logoUrl: urlData.publicUrl }));
      toast.success(TOAST_MESSAGES.SETTINGS_LOGO_UPLOADED);
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

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

      await upsertCompanyLogo(companyId, null);

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
      await upsertCompanyProfile(companyId, {
        companyName: companyForm.companyName,
        companyAddress: companyForm.companyAddress,
        hstNumber: companyForm.hstNumber,
      });

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
      await upsertCompanyNotificationSettings(companyId, {
        pushNotificationsEnabled: notifSettings.pushNotifications,
        lowStockThreshold: notifSettings.lowStockThreshold,
        criticalStockThreshold: notifSettings.criticalStockThreshold,
      });

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

  return {
    fileInputRef,
    profileSettings,
    setProfileSettings,
    companyForm,
    setCompanyForm,
    notifSettings,
    setNotifSettings,
    isUploadingLogo,
    logoPreviewUrl,
    cropSrc,
    setCropSrc,
    isSavingCompany,
    isSavingNotifSettings,
    handleClickLogoUpload,
    handleLogoUpload,
    handleCroppedUpload,
    handleCropCancel,
    handleRemoveLogo,
    handleSaveCompanySettings,
    handleSaveNotifSettings,
  };
}
