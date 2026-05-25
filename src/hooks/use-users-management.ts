"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { queryKeys } from "@/lib/query-keys";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import type { CompanyRole } from "@/types/company";
import type { CompanyMember, PendingInvitation } from "@/types/member";

export function useUsersManagement() {
  const { companyId, isOwner } = useCompany();
  const queryClient = useQueryClient();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CompanyMember | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks userId undergoing action

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: membersData, isLoading: membersLoading } = useQuery<{ members: CompanyMember[] }>({
    queryKey: queryKeys.companyMembers(companyId),
    queryFn: () => fetch(`/api/company/members?companyId=${companyId}`).then((r) => r.json()),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: invitationsData, isLoading: invitationsLoading } = useQuery<{
    invitations: PendingInvitation[];
  }>({
    queryKey: queryKeys.companyInvitations(companyId),
    queryFn: () => fetch(`/api/company/invitations?companyId=${companyId}`).then((r) => r.json()),
    enabled: isOwner,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const members = membersData?.members ?? [];
  const invitations = invitationsData?.invitations ?? [];

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.companyInvitations(companyId) });
  }, [queryClient, companyId]);

  // ── Member actions ────────────────────────────────────────────────────────
  const handleRoleChange = async (userId: string, newRole: CompanyRole) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/company/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
    const newStatus = member.status === "active" ? "suspended" : "active";
    setActionLoading(member.userId);
    try {
      const res = await fetch(`/api/company/members/${member.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? TOAST_MESSAGES.ERROR_GENERIC);
        return;
      }
      toast.success(
        newStatus === "suspended"
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
        { method: "DELETE" },
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

  // ── Invitation actions ────────────────────────────────────────────────────
  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/company/invitations/${invitationId}?companyId=${companyId}`, {
        method: "DELETE",
      });
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

  return {
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
  };
}
