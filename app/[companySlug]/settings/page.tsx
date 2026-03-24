'use client';
import { RoleGuard } from '@/components/common/RoleGuard';
import Settings from '@/page-components/Settings';
export default function SettingsPage() {
  return <RoleGuard allowedRoles={['owner']}><Settings /></RoleGuard>;
}
