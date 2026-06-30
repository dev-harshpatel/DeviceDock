"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { CompanySettingsSection } from "@/components/settings/CompanySettingsSection";
import { ProfileSettingsSection } from "@/components/settings/ProfileSettingsSection";
import { NotificationSettingsSection } from "@/components/settings/NotificationSettingsSection";
import { InventoryThresholdSection } from "@/components/settings/InventoryThresholdSection";
import { LogoCropModal } from "@/components/modals/LogoCropModal";
import { useSettingsManagement } from "@/hooks/use-settings-management";

export default function Settings() {
  const {
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
    isSavingCompany,
    isSavingNotifSettings,
    handleClickLogoUpload,
    handleLogoUpload,
    handleCroppedUpload,
    handleCropCancel,
    handleRemoveLogo,
    handleSaveCompanySettings,
    handleSaveNotifSettings,
  } = useSettingsManagement();

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
        <CompanySettingsSection
          companyForm={companyForm}
          setCompanyForm={setCompanyForm}
          logoPreviewUrl={logoPreviewUrl}
          isUploadingLogo={isUploadingLogo}
          isSavingCompany={isSavingCompany}
          fileInputRef={fileInputRef}
          handleClickLogoUpload={handleClickLogoUpload}
          handleLogoUpload={handleLogoUpload}
          handleRemoveLogo={handleRemoveLogo}
          handleSaveCompanySettings={handleSaveCompanySettings}
        />

        {/* Profile Section */}
        <ProfileSettingsSection
          profileSettings={profileSettings}
          setProfileSettings={setProfileSettings}
        />

        {/* Notifications Section */}
        <NotificationSettingsSection
          notifSettings={notifSettings}
          setNotifSettings={setNotifSettings}
        />

        {/* Inventory Thresholds */}
        <InventoryThresholdSection
          notifSettings={notifSettings}
          setNotifSettings={setNotifSettings}
        />

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
