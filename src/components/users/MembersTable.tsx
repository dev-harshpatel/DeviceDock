"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/common/Loader";
import { ROLE_LABELS, type CompanyRole } from "@/types/company";
import type { CompanyMember } from "@/types/member";
import { MoreHorizontal, ShieldCheck, UserX, XCircle, RefreshCw } from "lucide-react";

const ASSIGNABLE_ROLES = ["owner", "manager", "inventory_admin", "analyst"] as const;

interface MembersTableProps {
  members: CompanyMember[];
  isOwner: boolean;
  membersLoading: boolean;
  actionLoading: string | null;
  handleRoleChange: (userId: string, newRole: CompanyRole) => Promise<void>;
  handleStatusToggle: (member: CompanyMember) => Promise<void>;
  setRemoveTarget: (member: CompanyMember) => void;
}

// ── Status badge helper ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "active" | "suspended" }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "active"
          ? "border-green-500/40 text-green-600 bg-green-500/10"
          : "border-yellow-500/40 text-yellow-600 bg-yellow-500/10"
      }
    >
      {status === "active" ? "Active" : "Suspended"}
    </Badge>
  );
}

// ── Role badge helper ───────────────────────────────────────────────────────
function RoleBadge({ role }: { role: CompanyRole }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

// ── Member actions dropdown ─────────────────────────────────────────────────
interface MemberActionsMenuProps {
  member: CompanyMember;
  loading: boolean;
  onStatusToggle: () => void;
  onRemove: () => void;
}

function MemberActionsMenu({ member, loading, onStatusToggle, onRemove }: MemberActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={loading} aria-label="Member actions">
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {member.status === "active" ? (
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

export function MembersTable({
  members,
  isOwner,
  membersLoading,
  actionLoading,
  handleRoleChange,
  handleStatusToggle,
  setRemoveTarget,
}: MembersTableProps) {
  if (membersLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader size="lg" text="Loading members…" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">No members yet.</p>
      </div>
    );
  }

  return (
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
              {isOwner && <th className="text-right font-medium px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member, idx) => (
              <tr
                key={member.userId}
                className={idx % 2 === 0 ? "bg-background" : "bg-table-zebra"}
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {member.firstName} {member.lastName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                <td className="px-4 py-3">
                  {isOwner && member.role !== "owner" ? (
                    <Select
                      value={member.role}
                      onValueChange={(val) => handleRoleChange(member.userId, val as CompanyRole)}
                      disabled={actionLoading === member.userId}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.filter((r) => r !== "owner").map((r) => (
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
                    {member.role !== "owner" && (
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
                <p className="text-xs text-muted-foreground mt-0.5">{member.email}</p>
              </div>
              {isOwner && member.role !== "owner" && (
                <MemberActionsMenu
                  member={member}
                  loading={actionLoading === member.userId}
                  onStatusToggle={() => handleStatusToggle(member)}
                  onRemove={() => setRemoveTarget(member)}
                />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isOwner && member.role !== "owner" ? (
                <Select
                  value={member.role}
                  onValueChange={(val) => handleRoleChange(member.userId, val as CompanyRole)}
                  disabled={actionLoading === member.userId}
                >
                  <SelectTrigger className="h-7 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.filter((r) => r !== "owner").map((r) => (
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
  );
}
