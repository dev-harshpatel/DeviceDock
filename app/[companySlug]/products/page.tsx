'use client';
import { RoleGuard } from '@/components/common/RoleGuard';
import ProductManagement from '@/page-components/ProductManagement';
export default function ProductsPage() {
  return <RoleGuard allowedRoles={['owner', 'manager', 'inventory_admin']}><ProductManagement /></RoleGuard>;
}
