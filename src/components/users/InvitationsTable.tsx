"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/common/Loader";
import { ROLE_LABELS, type CompanyRole } from "@/types/company";
import type { PendingInvitation } from "@/types/member";
import { Check, Copy, Mail, XCircle, Clock, UserPlus } from "lucide-react";

interface InvitationsTableProps {
  invitations: PendingInvitation[];
  invitationsLoading: boolean;
  setInviteModalOpen: (open: boolean) => void;
  handleCancelInvitation: (invitationId: string) => Promise<void>;
}

// ── Role badge helper ───────────────────────────────────────────────────────
function RoleBadge({ role }: { role: CompanyRole }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

// ── Expiry label ────────────────────────────────────────────────────────────
function ExpiryLabel({ expiresAt }: { expiresAt: string }) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days <= 0) return <span className="text-destructive">Expired</span>;
  if (days === 1) return <span>Expires tomorrow</span>;
  return <span>Expires in {days} days</span>;
}

// ── Copy invite link button (with feedback) ──────────────────────────────────
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

export function InvitationsTable({
  invitations,
  invitationsLoading,
  setInviteModalOpen,
  handleCancelInvitation,
}: InvitationsTableProps) {
  if (invitationsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader size="lg" text="Loading invitations…" />
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
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
    );
  }

  return (
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
              <tr key={inv.id} className={idx % 2 === 0 ? "bg-background" : "bg-table-zebra"}>
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
          <div key={inv.id} className="p-4 bg-card rounded-lg border border-border space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground text-sm">{inv.inviteeEmail}</p>
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
  );
}
