'use client';
import { RoleGuard } from '@/components/common/RoleGuard';
import UploadProducts from '@/page-components/UploadProducts';
export default function UploadProductsPage() {
  return <RoleGuard allowedRoles={['owner', 'manager', 'inventory_admin']}><UploadProducts /></RoleGuard>;
}
