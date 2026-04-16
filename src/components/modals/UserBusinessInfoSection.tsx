"use client";

import { Building2, Edit2, Globe, Loader2, Mail, MapPin, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserProfile } from "@/types/user";

interface EditForm {
  businessName: string;
  businessAddress: string;
  businessCity: string;
  businessState: string;
  businessCountry: "Canada" | "USA" | "";
}

interface UserBusinessInfoSectionProps {
  user: UserProfile;
  isEditing: boolean;
  isSaving: boolean;
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
}

export function UserBusinessInfoSection({
  user,
  isEditing,
  isSaving,
  editForm,
  setEditForm,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
}: UserBusinessInfoSectionProps) {
  return (
    <div className="space-y-4">
      {!isEditing && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onStartEdit} className="gap-2">
            <Edit2 className="h-4 w-4" />
            Edit Details
          </Button>
        </div>
      )}

      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="businessName" className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" />
                Business Name
              </Label>
              <Input
                id="businessName"
                value={editForm.businessName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, businessName: e.target.value }))}
                placeholder="Enter business name"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="businessAddress" className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                Business Address
              </Label>
              <Input
                id="businessAddress"
                value={editForm.businessAddress}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, businessAddress: e.target.value }))
                }
                placeholder="Enter business address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessCity" className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                City
              </Label>
              <Input
                id="businessCity"
                value={editForm.businessCity}
                onChange={(e) => setEditForm((prev) => ({ ...prev, businessCity: e.target.value }))}
                placeholder="Enter city"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessCountry" className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                Country
              </Label>
              <Select
                value={editForm.businessCountry}
                onValueChange={(value) =>
                  setEditForm((prev) => ({
                    ...prev,
                    businessCountry: value as "Canada" | "USA",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="USA">USA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelEdit}
              disabled={isSaving}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button size="sm" onClick={onSaveEdit} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>Business Name</span>
            </div>
            <p className="font-medium text-foreground">{user.businessName || "N/A"}</p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Business Address</span>
            </div>
            <p className="font-medium text-foreground">{user.businessAddress || "N/A"}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>City</span>
            </div>
            <p className="font-medium text-foreground">{user.businessCity || "N/A"}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>State/Province</span>
            </div>
            <p className="font-medium text-foreground">{user.businessState || "N/A"}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Country</span>
            </div>
            <p className="font-medium text-foreground">{user.businessCountry || "N/A"}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Years in Business</span>
            </div>
            <p className="font-medium text-foreground">
              {user.businessYears != null ? `${user.businessYears} years` : "N/A"}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>Business Email</span>
            </div>
            <p className="font-medium text-foreground">{user.businessEmail || "N/A"}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>Website</span>
            </div>
            <p className="font-medium text-foreground">
              {user.businessWebsite ? (
                <a
                  href={user.businessWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {user.businessWebsite}
                </a>
              ) : (
                "N/A"
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
