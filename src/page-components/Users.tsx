"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InviteUserModal } from "@/components/modals/InviteUserModal";
import { useUsersManagement } from "@/hooks/use-users-management";
import { MembersTable } from "@/components/users/MembersTable";
import { InvitationsTable } from "@/components/users/InvitationsTable";
import { UserPlus } from "lucide-react";

export default function Users() {
  const {
    companyId,
    isOwner,
    inviteModalOpen,
    setInviteModalOpen,
    removeTarget,
    setRemoveTarget,
    actionLoading,
    membersLoading,
    invitationsLoading,
    members,
    invitations,
    refreshAll,
    handleRoleChange,
    handleStatusToggle,
    handleRemoveMember,
    handleCancelInvitation,
  } = useUsersManagement();

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b border-border mb-4 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-4 lg:pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Team Members</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {members.length} {members.length === 1 ? "member" : "members"}
              {isOwner && invitations.length > 0 && ` · ${invitations.length} pending`}
            </p>
          </div>
          {isOwner && (
            <Button onClick={() => setInviteModalOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Invite Member</span>
              <span className="sm:hidden">Invite</span>
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-4 lg:-mx-6 px-4 lg:px-6">
        <Tabs defaultValue="members">
          <TabsList className="mb-4">
            <TabsTrigger value="members">Members</TabsTrigger>
            {isOwner && (
              <TabsTrigger value="invitations">
                Invitations
                {invitations.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/15 text-primary text-xs px-1.5 py-0.5 font-medium">
                    {invitations.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Members list */}
          <TabsContent value="members">
            <MembersTable
              members={members}
              isOwner={isOwner}
              membersLoading={membersLoading}
              actionLoading={actionLoading}
              handleRoleChange={handleRoleChange}
              handleStatusToggle={handleStatusToggle}
              setRemoveTarget={setRemoveTarget}
            />
          </TabsContent>

          {/* Invitations list */}
          {isOwner && (
            <TabsContent value="invitations">
              <InvitationsTable
                invitations={invitations}
                invitationsLoading={invitationsLoading}
                setInviteModalOpen={setInviteModalOpen}
                handleCancelInvitation={handleCancelInvitation}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Invite modal */}
      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        companyId={companyId}
        onInviteSent={refreshAll}
      />

      {/* Remove confirmation dialog */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget && (
                <>
                  <strong>
                    {removeTarget.firstName} {removeTarget.lastName}
                  </strong>{" "}
                  will lose access to this company immediately. This cannot be undone without
                  re-inviting them.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
