'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  UserPlus,
  Copy,
  Check,
  Mail,
  Clock,
  XCircle,
  ShieldCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader } from '@/components/common/Loader';
import { InviteUserModal } from '@/components/modals/InviteUserModal';
import { useCompany } from '@/contexts/CompanyContext';
import { queryKeys } from '@/lib/query-keys';
import { ROLE_LABELS, type CompanyRole } from '@/types/company';
import { TOAST_MESSAGES } from '@/lib/constants/toast-messages';
import type { CompanyMember, PendingInvitation } from '@/types/member';

// ---------------------------------------------------------------------------
// Role options available to assign to existing members
// ---------------------------------------------------------------------------
const ASSIGNABLE_ROLES = ['owner', 'manager', 'inventory_admin', 'analyst'] as const;

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: 'active' | 'suspended' }) {
  return (
    <Badge
      variant="outline"
      className={
        status === 'active'
          ? 'border-green-500/40 text-green-600 bg-green-500/10'
          : 'border-yellow-500/40 text-yellow-600 bg-yellow-500/10'
      }
    >
      {status === 'active' ? 'Active' : 'Suspended'}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Role badge helper
// ---------------------------------------------------------------------------
function RoleBadge({ role }: { role: CompanyRole }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Copy invite link button (with feedback)
// ---------------------------------------------------------------------------
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} aria-label="Copy invite link">
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Users() {
  const { companyId, isOwner } = useCompany();
  const queryClient = useQueryClient();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CompanyMember | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks userId undergoing action

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const {
    data: membersData,
    isLoading: membersLoading,
  } = useQuery<{ members: CompanyMember[] }>({
    queryKey: queryKeys.companyMembers(companyId),
    queryFn: () =>
      fetch(`/api/company/members?companyId=${companyId}`).then((r) => r.json()),
  });

  const {
    data: invitationsData,
    isLoading: invitationsLoading,
  } = useQuery<{ invitations: PendingInvitation[] }>({
    queryKey: queryKeys.companyInvitations(companyId),
    queryFn: () =>
      fetch(`/api/company/invitations?companyId=${companyId}`).then((r) => r.json()),
    enabled: isOwner,
  });

  const members = membersData?.members ?? [];
  const invitations = invitationsData?.invitations ?? [];

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.companyInvitations(companyId) });
  }, [queryClient, companyId]);

  // -------------------------------------------------------------------------
  // Member actions
  // -------------------------------------------------------------------------
  const handleRoleChange = async (userId: string, newRole: CompanyRole) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/company/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? TOAST_MESSAGES.ERROR_GENERIC);
        return;
      }
      toast.success(TOAST_MESSAGES.MEMBER_ROLE_UPDATED);
      queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
    } catch {
      toast.error(TOAST_MESSAGES.ERROR_GENERIC);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusToggle = async (member: CompanyMember) => {
    const newStatus = member.status === 'active' ? 'suspended' : 'active';
    setActionLoading(member.userId);
    try {
      const res = await fetch(`/api/company/members/${member.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? TOAST_MESSAGES.ERROR_GENERIC);
        return;
      }
      toast.success(
        newStatus === 'suspended'
          ? TOAST_MESSAGES.MEMBER_SUSPENDED
          : TOAST_MESSAGES.MEMBER_REACTIVATED,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
    } catch {
      toast.error(TOAST_MESSAGES.ERROR_GENERIC);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setActionLoading(removeTarget.userId);
    try {
      const res = await fetch(
        `/api/company/members/${removeTarget.userId}?companyId=${companyId}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? TOAST_MESSAGES.ERROR_GENERIC);
        return;
      }
      toast.success(TOAST_MESSAGES.MEMBER_REMOVED);
      queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
    } catch {
      toast.error(TOAST_MESSAGES.ERROR_GENERIC);
    } finally {
      setActionLoading(null);
      setRemoveTarget(null);
    }
  };

  // -------------------------------------------------------------------------
  // Invitation actions
  // -------------------------------------------------------------------------
  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(
        `/api/company/invitations/${invitationId}?companyId=${companyId}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? TOAST_MESSAGES.ERROR_GENERIC);
        return;
      }
      toast.success(TOAST_MESSAGES.INVITE_CANCELLED);
      queryClient.invalidateQueries({ queryKey: queryKeys.companyInvitations(companyId) });
    } catch {
      toast.error(TOAST_MESSAGES.ERROR_GENERIC);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b border-border mb-4 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-4 lg:pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Team Members</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {members.length} {members.length === 1 ? 'member' : 'members'}
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

          {/* ================================================================
              MEMBERS TAB
          ================================================================ */}
          <TabsContent value="members">
            {membersLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader size="lg" text="Loading members…" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-sm">No members yet.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                        <th className="text-left font-medium px-4 py-3">Name</th>
                        <th className="text-left font-medium px-4 py-3">Email</th>
                        <th className="text-left font-medium px-4 py-3">Role</th>
                        <th className="text-left font-medium px-4 py-3">Status</th>
                        {isOwner && (
                          <th className="text-right font-medium px-4 py-3">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member, idx) => (
                        <tr
                          key={member.userId}
                          className={
                            idx % 2 === 0 ? 'bg-background' : 'bg-table-zebra'
                          }
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {member.firstName} {member.lastName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {member.email}
                          </td>
                          <td className="px-4 py-3">
                            {isOwner && member.role !== 'owner' ? (
                              <Select
                                value={member.role}
                                onValueChange={(val) =>
                                  handleRoleChange(member.userId, val as CompanyRole)
                                }
                                disabled={actionLoading === member.userId}
                              >
                                <SelectTrigger className="h-8 w-[140px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ASSIGNABLE_ROLES.filter((r) => r !== 'owner').map((r) => (
                                    <SelectItem key={r} value={r} className="text-xs">
                                      {ROLE_LABELS[r]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <RoleBadge role={member.role} />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={member.status} />
                          </td>
                          {isOwner && (
                            <td className="px-4 py-3 text-right">
                              {member.role !== 'owner' && (
                                <MemberActionsMenu
                                  member={member}
                                  loading={actionLoading === member.userId}
                                  onStatusToggle={() => handleStatusToggle(member)}
                                  onRemove={() => setRemoveTarget(member)}
                                />
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.userId}
                      className="p-4 bg-card rounded-lg border border-border space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {member.email}
                          </p>
                        </div>
                        {isOwner && member.role !== 'owner' && (
                          <MemberActionsMenu
                            member={member}
                            loading={actionLoading === member.userId}
                            onStatusToggle={() => handleStatusToggle(member)}
                            onRemove={() => setRemoveTarget(member)}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isOwner && member.role !== 'owner' ? (
                          <Select
                            value={member.role}
                            onValueChange={(val) =>
                              handleRoleChange(member.userId, val as CompanyRole)
                            }
                            disabled={actionLoading === member.userId}
                          >
                            <SelectTrigger className="h-7 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE_ROLES.filter((r) => r !== 'owner').map((r) => (
                                <SelectItem key={r} value={r} className="text-xs">
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <RoleBadge role={member.role} />
                        )}
                        <StatusBadge status={member.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* ================================================================
              INVITATIONS TAB (owners only)
          ================================================================ */}
          {isOwner && (
            <TabsContent value="invitations">
              {invitationsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader size="lg" text="Loading invitations…" />
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <Mail className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">No pending invitations.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInviteModalOpen(true)}
                    className="mt-2 gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Invite a team member
                  </Button>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                          <th className="text-left font-medium px-4 py-3">Email</th>
                          <th className="text-left font-medium px-4 py-3">Role</th>
                          <th className="text-left font-medium px-4 py-3">Expires</th>
                          <th className="text-right font-medium px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invitations.map((inv, idx) => (
                          <tr
                            key={inv.id}
                            className={idx % 2 === 0 ? 'bg-background' : 'bg-table-zebra'}
                          >
                            <td className="px-4 py-3 text-foreground">{inv.inviteeEmail}</td>
                            <td className="px-4 py-3">
                              <RoleBadge role={inv.roleToAssign} />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              <ExpiryLabel expiresAt={inv.expiresAt} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <CopyLinkButton url={inv.inviteUrl} />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelInvitation(inv.id)}
                                  aria-label="Cancel invitation"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {invitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-4 bg-card rounded-lg border border-border space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              {inv.inviteeEmail}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <RoleBadge role={inv.roleToAssign} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <CopyLinkButton url={inv.inviteUrl} />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelInvitation(inv.id)}
                              aria-label="Cancel invitation"
                              className="text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <ExpiryLabel expiresAt={inv.expiresAt} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
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
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget && (
                <>
                  <strong>{removeTarget.firstName} {removeTarget.lastName}</strong> will
                  lose access to this company immediately. This cannot be undone without
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

// ---------------------------------------------------------------------------
// Member actions dropdown
// ---------------------------------------------------------------------------
interface MemberActionsMenuProps {
  member: CompanyMember;
  loading: boolean;
  onStatusToggle: () => void;
  onRemove: () => void;
}

function MemberActionsMenu({
  member,
  loading,
  onStatusToggle,
  onRemove,
}: MemberActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={loading}
          aria-label="Member actions"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {member.status === 'active' ? (
          <DropdownMenuItem onClick={onStatusToggle} className="gap-2">
            <UserX className="h-4 w-4" />
            Suspend
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onStatusToggle} className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Reactivate
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onRemove}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <XCircle className="h-4 w-4" />
          Remove from company
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Expiry label
// ---------------------------------------------------------------------------
function ExpiryLabel({ expiresAt }: { expiresAt: string }) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days <= 0) return <span className="text-destructive">Expired</span>;
  if (days === 1) return <span>Expires tomorrow</span>;
  return <span>Expires in {days} days</span>;
}
