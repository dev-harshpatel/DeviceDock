import type { CompanyRole } from './company';

export interface CompanyMember {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: CompanyRole;
  status: 'active' | 'suspended';
  joinedAt: string;
}

export interface PendingInvitation {
  id: string;
  inviteeEmail: string;
  roleToAssign: CompanyRole;
  expiresAt: string;
  createdAt: string;
  inviteUrl: string;
}
