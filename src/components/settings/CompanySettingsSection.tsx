import React from "react";
import { Building2, Loader2, Upload, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { CompanySettingsForm } from "@/hooks/use-settings-management";

interface CompanySettingsSectionProps {
  companyForm: CompanySettingsForm;
  setCompanyForm: React.Dispatch<React.SetStateAction<CompanySettingsForm>>;
  logoPreviewUrl: string | null;
  isUploadingLogo: boolean;
  isSavingCompany: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleClickLogoUpload: () => void;
  handleLogoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveLogo: () => Promise<void>;
  handleSaveCompanySettings: () => Promise<void>;
}

export function CompanySettingsSection({
  companyForm,
  setCompanyForm,
  logoPreviewUrl,
  isUploadingLogo,
  isSavingCompany,
  fileInputRef,
  handleClickLogoUpload,
  handleLogoUpload,
  handleRemoveLogo,
  handleSaveCompanySettings,
}: CompanySettingsSectionProps) {
  return (
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
                PNG, JPG or SVG · max 5 MB · landscape or square logos work best on invoices (avoid
                tall portrait images)
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
  );
}
