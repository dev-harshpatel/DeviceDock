'use client'

import { useAuth } from './context'
import { useUserProfile } from '@/contexts/UserProfileContext'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
  requireAuth?: boolean
  requireAdmin?: boolean
}

const PAGE_LEVEL_LOADING_ADMIN_PATHS = [
  '/admin/dashboard',
  '/admin/reports',
  '/admin/hst',
  '/admin/products',
]

function AuthGuardInner({ 
  children, 
  redirectTo = '/admin/login', 
  requireAuth = true,
  requireAdmin = false
}: AuthGuardProps) {
  const { user, loading: authLoading } = useAuth()
  const { profile, isLoading: profileLoading, isAdmin } = useUserProfile()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [isRedirecting, setIsRedirecting] = useState(false)

  const loading = authLoading || profileLoading
  const usePageLevelLoading =
    requireAdmin &&
    PAGE_LEVEL_LOADING_ADMIN_PATHS.some((path) => pathname?.startsWith(path))

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        // Redirect to home page where they can use the login modal
        setIsRedirecting(true)
        router.push(redirectTo)
      } else if (requireAdmin) {
        // Require admin role
        if (!user) {
          // Not logged in - redirect to home page
          setIsRedirecting(true)
          router.push(redirectTo)
        } else if (!isAdmin) {
          // Logged in but not admin - keep admin-only boundary
          setIsRedirecting(true)
          router.replace('/admin/login')
        }
      } else if (!requireAuth && user) {
        // If user is authenticated but shouldn't be on this page (like login/signup)
        setIsRedirecting(true)
        const redirectPath = searchParams.get('redirect') || '/admin/dashboard'
        router.push(redirectPath)
      }
    }
  }, [user, loading, isAdmin, router, redirectTo, requireAuth, requireAdmin, searchParams, pathname])

  // Show loading spinner while redirecting. For selected admin pages we skip
  // the generic "Crafting..." loader and allow page-level skeletons instead.
  if (isRedirecting || (loading && !usePageLevelLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-indigo-600 font-medium">
            {loading ? 'Crafting...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    )
  }

  if (loading && usePageLevelLoading) {
    return <>{children}</>
  }

  // Only show children if user state matches requirement
  // Check these conditions BEFORE rendering children to prevent flash of content
  
  if (requireAuth && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-indigo-600 font-medium">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // CRITICAL: Block non-admin users from seeing admin content
  if (requireAdmin && (!user || !isAdmin)) {
    // Don't render children - immediately show redirect message
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-indigo-600 font-medium">
            {!user ? 'Redirecting to login...' : 'Access Denied. Redirecting...'}
          </p>
        </div>
      </div>
    )
  }

  if (!requireAuth && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-indigo-600 font-medium">Redirecting...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function AuthGuard(props: AuthGuardProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-indigo-600 font-medium">Loading...</p>
        </div>
      </div>
    }>
      <AuthGuardInner {...props} />
    </Suspense>
  )
}
