'use client';
import { RoleGuard } from '@/components/common/RoleGuard';
import Orders from '@/page-components/Orders';
export default function OrdersPage() {
  return <RoleGuard allowedRoles={['owner', 'manager']}><Orders /></RoleGuard>;
}
