'use client';
import { RoleGuard } from '@/components/common/RoleGuard';
import Users from '@/page-components/Users';
export default function UsersPage() {
  return <RoleGuard allowedRoles={['owner']}><Users /></RoleGuard>;
}
