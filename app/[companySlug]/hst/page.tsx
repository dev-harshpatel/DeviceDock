'use client';
import { RoleGuard } from '@/components/common/RoleGuard';
import HSTReconciliation from '@/page-components/HSTReconciliation';
export default function HSTPage() {
  return <RoleGuard allowedRoles={['owner', 'manager']}><HSTReconciliation /></RoleGuard>;
}
