"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { UserBusinessInfoSection } from "@/components/modals/UserBusinessInfoSection";
import { UserPersonalInfoTab } from "@/components/modals/UserPersonalInfoTab";

interface UserDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onStatusUpdate?: () => void;
}

type EditForm = {
  businessName: string;
  businessAddress: string;
  businessCity: string;
  businessState: string;
  businessCountry: "Canada" | "USA" | "";
};

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
  const [editForm, setEditForm] = useState<EditForm>({
    businessName: "",
    businessAddress: "",
    businessCity: "",
    businessState: "",
    businessCountry: "",
  });

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
    setIsEditing(false);
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
    } catch {
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
      toast.success("User profile has been approved. They can now place orders.");
      setShowConfirmApprove(false);
      onStatusUpdate?.();
      onOpenChange(false);
    } catch {
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
    } catch {
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
    } catch {
      toast.error("Failed to delete user. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const canApprove = user.approvalStatus === "pending" || user.approvalStatus === "rejected";
  const canReject = user.approvalStatus === "pending";
  const canDelete = user.approvalStatus === "approved" || user.approvalStatus === "rejected";

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "N/A";

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
                className={cn("text-sm flex-shrink-0", getStatusColor(user.approvalStatus))}
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
                <UserPersonalInfoTab user={user} fullName={fullName} />
              </TabsContent>

              <TabsContent value="business" className="space-y-4 mt-4">
                <UserBusinessInfoSection
                  user={user}
                  isEditing={isEditing}
                  isSaving={isSaving}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                />
              </TabsContent>
            </Tabs>
          </div>

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

      <ConfirmActionDialog
        open={showConfirmApprove}
        onOpenChange={setShowConfirmApprove}
        title="Approve Profile"
        description="Are you sure you want to approve this user profile? They will be able to place orders once approved."
        confirmLabel="Approve"
        isLoading={isApproving}
        loadingLabel="Approving..."
        onConfirm={handleApprove}
      />

      <ConfirmActionDialog
        open={showConfirmReject}
        onOpenChange={setShowConfirmReject}
        title="Reject Profile"
        description="Are you sure you want to reject this user profile? They will not be able to place orders."
        confirmLabel="Reject"
        confirmVariant="destructive"
        isLoading={isRejecting}
        loadingLabel="Rejecting..."
        onConfirm={handleReject}
      />

      <ConfirmActionDialog
        open={showConfirmDelete}
        onOpenChange={setShowConfirmDelete}
        title={
          <span className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete User
          </span>
        }
        description={
          <div className="space-y-2 pt-1">
            <span className="block">
              You are about to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || "this user"}
              </span>{" "}
              from the platform.
            </span>
            <span className="block text-destructive font-medium">
              This action cannot be undone. All their data, orders, and account access will be
              permanently removed.
            </span>
          </div>
        }
        confirmLabel={
          <>
            <Trash2 className="mr-2 h-4 w-4" />
            Yes, Delete User
          </>
        }
        confirmVariant="destructive"
        isLoading={isDeleting}
        loadingLabel="Deleting..."
        onConfirm={handleDelete}
      />
    </>
  );
};
