'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/lib/auth/AuthGuard'
import { usePathname } from 'next/navigation'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // /admin/login has its own standalone layout — skip AuthGuard and AppLayout
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  // All other admin routes require ADMIN role
  // Unauthenticated users are redirected to admin login page
  return (
    <AuthGuard requireAuth={true} requireAdmin={true} redirectTo="/admin/login">
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  )
}

