import { UserProfile, ApprovalStatus } from "@/types/user";
import {
  updateUserProfileApprovalStatus,
  updateUserProfileDetails,
  deleteUser,
} from "@/lib/supabase/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { cn } from "@/lib/utils";
import { formatDateTimeInOntario } from "@/lib/utils/formatters";
import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface UserDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onStatusUpdate?: () => void;
}

const getStatusColor = (status: ApprovalStatus) => {
  switch (status) {
    case "pending":
      return "bg-warning/10 text-warning border-warning/20";
    case "approved":
      return "bg-success/10 text-success border-success/20";
    case "rejected":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStatusLabel = (status: ApprovalStatus) => {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
};

export const UserDetailsModal = ({
  open,
  onOpenChange,
  user,
  onStatusUpdate,
}: UserDetailsModalProps) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);
  const [showConfirmReject, setShowConfirmReject] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    businessName: "",
    businessAddress: "",
    businessCity: "",
    businessState: "",
    businessCountry: "" as "Canada" | "USA" | "",
  });

  // Reset edit form when user changes or modal opens
  const resetEditForm = () => {
    if (user) {
      setEditForm({
        businessName: user.businessName || "",
        businessAddress: user.businessAddress || "",
        businessCity: user.businessCity || "",
        businessState: user.businessState || "",
        businessCountry: (user.businessCountry as "Canada" | "USA") || "",
      });
    }
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (user) {
      setEditForm({
        businessName: user.businessName || "",
        businessAddress: user.businessAddress || "",
        businessCity: user.businessCity || "",
        businessState: user.businessState || "",
        businessCountry: (user.businessCountry as "Canada" | "USA") || "",
      });
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    resetEditForm();
  };

  const handleSaveEdit = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await updateUserProfileDetails(user.userId, {
        businessName: editForm.businessName || null,
        businessAddress: editForm.businessAddress || null,
        businessCity: editForm.businessCity || null,
        businessCountry: editForm.businessCountry || null,
      });

      toast.success(TOAST_MESSAGES.PROFILE_UPDATED);

      setIsEditing(false);
      onStatusUpdate?.();
    } catch (error) {
      toast.error(TOAST_MESSAGES.PROFILE_UPDATE_FAILED);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await updateUserProfileApprovalStatus(user.userId, "approved");

      toast.success(
        "User profile has been approved. They can now place orders."
      );

      setShowConfirmApprove(false);
      onStatusUpdate?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(TOAST_MESSAGES.PROFILE_APPROVE_FAILED);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await updateUserProfileApprovalStatus(user.userId, "rejected");

      toast.success(TOAST_MESSAGES.PROFILE_REJECTED);

      setShowConfirmReject(false);
      onStatusUpdate?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(TOAST_MESSAGES.PROFILE_REJECT_FAILED);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteUser(user.userId);
      toast.success("User has been permanently deleted from the platform.");
      setShowConfirmDelete(false);
      onStatusUpdate?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to delete user. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const canApprove =
    user.approvalStatus === "pending" || user.approvalStatus === "rejected";
  const canReject = user.approvalStatus === "pending";
  const canDelete =
    user.approvalStatus === "approved" || user.approvalStatus === "rejected";

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "N/A";
  const location =
    [user.businessCity, user.businessState, user.businessCountry]
      .filter(Boolean)
      .join(", ") || "N/A";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between pr-8">
              <div>
                <DialogTitle>User Profile Review</DialogTitle>
                <DialogDescription>
                  Review user details and approve or reject their profile
                </DialogDescription>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-sm flex-shrink-0",
                  getStatusColor(user.approvalStatus)
                )}
              >
                {getStatusLabel(user.approvalStatus)}
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="personal">Personal Information</TabsTrigger>
                <TabsTrigger value="business">Business Information</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Full Name</span>
                      </div>
                      <p className="font-medium text-foreground">{fullName}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>Phone</span>
                      </div>
                      <p className="font-medium text-foreground">
                        {user.phone || "N/A"}
                      </p>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>User ID</span>
                      </div>
                      <p className="font-medium text-foreground font-mono text-xs">
                        {user.userId}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Joined</span>
                      </div>
                      <p className="font-medium text-foreground">
                        {formatDateTimeInOntario(user.createdAt)}
                      </p>
                    </div>

                    {user.approvalStatusUpdatedAt && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Status Updated</span>
                        </div>
                        <p className="font-medium text-foreground">
                          {formatDateTimeInOntario(
                            user.approvalStatusUpdatedAt
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="business" className="space-y-4 mt-4">
                <div className="space-y-4">
                  {/* Edit Button Header */}
                  {!isEditing && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartEdit}
                        className="gap-2"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit Details
                      </Button>
                    </div>
                  )}

                  {isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label
                            htmlFor="businessName"
                            className="flex items-center gap-2 text-sm"
                          >
                            <Building2 className="h-4 w-4" />
                            Business Name
                          </Label>
                          <Input
                            id="businessName"
                            value={editForm.businessName}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                businessName: e.target.value,
                              }))
                            }
                            placeholder="Enter business name"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label
                            htmlFor="businessAddress"
                            className="flex items-center gap-2 text-sm"
                          >
                            <MapPin className="h-4 w-4" />
                            Business Address
                          </Label>
                          <Input
                            id="businessAddress"
                            value={editForm.businessAddress}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                businessAddress: e.target.value,
                              }))
                            }
                            placeholder="Enter business address"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="businessCity"
                            className="flex items-center gap-2 text-sm"
                          >
                            <MapPin className="h-4 w-4" />
                            City
                          </Label>
                          <Input
                            id="businessCity"
                            value={editForm.businessCity}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                businessCity: e.target.value,
                              }))
                            }
                            placeholder="Enter city"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="businessCountry"
                            className="flex items-center gap-2 text-sm"
                          >
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

                      {/* Edit Action Buttons */}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="gap-2"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={isSaving}
                          className="gap-2"
                        >
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
                    /* View Mode */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1 md:col-span-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span>Business Name</span>
                        </div>
                        <p className="font-medium text-foreground">
                          {user.businessName || "N/A"}
                        </p>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>Business Address</span>
                        </div>
                        <p className="font-medium text-foreground">
                          {user.businessAddress || "N/A"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>City</span>
                        </div>
                        <p className="font-medium text-foreground">
                          {user.businessCity || "N/A"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>State/Province</span>
                        </div>
                        <p className="font-medium text-foreground">
                          {user.businessState || "N/A"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>Country</span>
                        </div>
                        <p className="font-medium text-foreground">
                          {user.businessCountry || "N/A"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Years in Business</span>
                        </div>
                        <p className="font-medium text-foreground">
                          {user.businessYears !== null &&
                          user.businessYears !== undefined
                            ? `${user.businessYears} years`
                            : "N/A"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span>Business Email</span>
                        </div>
                        <p className="font-medium text-foreground">
                          {user.businessEmail || "N/A"}
                        </p>
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
              </TabsContent>
            </Tabs>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isApproving || isRejecting || isDeleting}
            >
              Close
            </Button>
            {canDelete && (
              <Button
                variant="destructive"
                onClick={() => setShowConfirmDelete(true)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete User
                  </>
                )}
              </Button>
            )}
            {canReject && (
              <Button
                variant="destructive"
                onClick={() => setShowConfirmReject(true)}
                disabled={isApproving || isRejecting}
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Profile
                  </>
                )}
              </Button>
            )}
            {canApprove && (
              <Button
                onClick={() => setShowConfirmApprove(true)}
                disabled={isApproving || isRejecting}
              >
                {isApproving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve Profile
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialogs */}
      {showConfirmApprove && (
        <Dialog open={showConfirmApprove} onOpenChange={setShowConfirmApprove}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Profile</DialogTitle>
              <DialogDescription>
                Are you sure you want to approve this user profile? They will be
                able to place orders once approved.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmApprove(false)}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={isApproving}>
                {isApproving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Approve"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showConfirmReject && (
        <Dialog open={showConfirmReject} onOpenChange={setShowConfirmReject}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Profile</DialogTitle>
              <DialogDescription>
                Are you sure you want to reject this user profile? They will not
                be able to place orders.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmReject(false)}
                disabled={isRejecting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isRejecting}
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  "Reject"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showConfirmDelete && (
        <Dialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete User
              </DialogTitle>
              <DialogDescription className="space-y-2 pt-1">
                <span className="block">
                  You are about to permanently delete{" "}
                  <span className="font-semibold text-foreground">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                      "this user"}
                  </span>{" "}
                  from the platform.
                </span>
                <span className="block text-destructive font-medium">
                  This action cannot be undone. All their data, orders, and
                  account access will be permanently removed.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDelete(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Yes, Delete User
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
