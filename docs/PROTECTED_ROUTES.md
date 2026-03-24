# Protected Routes Implementation

## Overview

All admin routes are now protected and require authentication. Users cannot access admin routes without logging in.

## Route Structure

### Admin Routes (All Protected)
All admin routes start with `/admin`:

- `/admin` → Redirects to `/admin/dashboard`
- `/admin/login` → **Public** (login page, no auth required)
- `/admin/dashboard` → Protected (requires auth)
- `/admin/inventory` → Protected (requires auth)
- `/admin/products` → Protected (requires auth)
- `/admin/orders` → Protected (requires auth)
- `/admin/alerts` → Protected (requires auth)
- `/admin/reports` → Protected (requires auth)
- `/admin/settings` → Protected (requires auth)

### Public Routes
- `/` → Home page (public)
- `/user` → User products page (public)
- `/admin/login` → Admin login (public)

## Protection Layers

### 1. Server-Side Protection (Middleware)
**File:** `src/lib/supabase/middleware.ts`

- Runs on the server before the page loads
- Checks if user is authenticated
- Redirects unauthenticated users to `/admin/login`
- Excludes `/admin/login` from protection

**How it works:**
```typescript
// All routes starting with /admin (except /admin/login) are protected
const isAdminRoute = pathname.startsWith('/admin')
const isAdminLogin = pathname === '/admin/login'
const isProtectedAdminRoute = isAdminRoute && !isAdminLogin

// Redirect if not authenticated
if (!user && isProtectedAdminRoute) {
  redirect to /admin/login
}
```

### 2. Client-Side Protection (AuthGuard)
**File:** `app/admin/layout.tsx`

- Wraps all admin pages (except login)
- Uses `AuthGuard` component to check authentication
- Shows loading state while checking
- Redirects to login if not authenticated

**How it works:**
```typescript
// Login page is excluded from protection
if (pathname === '/admin/login') {
  return children // No protection
}

// All other admin routes are protected
return (
  <AuthGuard requireAuth={true} redirectTo="/admin/login">
    <AppLayout>{children}</AppLayout>
  </AuthGuard>
)
```

### 3. Component-Level Protection (AuthGuard)
**File:** `src/lib/auth/AuthGuard.tsx`

- Checks if user is logged in
- Checks user profile is loaded
- Redirects to login page if not authenticated
- Preserves redirect path for after login

## User Flow

### Scenario 1: User tries to access `/admin/dashboard` without login

1. **Middleware** (server-side):
   - Detects user is not authenticated
   - Redirects to `/admin/login?redirect=/admin/dashboard`

2. **Login Page**:
   - User enters credentials
   - After login, redirects to `/admin/dashboard`

### Scenario 2: User is logged in and tries to access `/admin/login`

1. **Login Page**:
   - Detects user is already logged in
   - Automatically redirects to `/admin/dashboard`

### Scenario 3: User clicks logout

1. **Navbar Dropdown**:
   - User clicks profile avatar → "Log out"
   - Logs out and redirects to `/admin/login`

## Testing Protected Routes

### Test 1: Access admin route without login
1. Logout (if logged in)
2. Navigate to `http://localhost:3000/admin/dashboard`
3. **Expected:** Redirects to `/admin/login?redirect=/admin/dashboard`

### Test 2: Access admin route after login
1. Login with admin credentials
2. Navigate to `http://localhost:3000/admin/dashboard`
3. **Expected:** Shows dashboard

### Test 3: Try to access login page when logged in
1. Login with admin credentials
2. Navigate to `http://localhost:3000/admin/login`
3. **Expected:** Redirects to `/admin/dashboard`

### Test 4: Logout functionality
1. While logged in, click profile avatar
2. Click "Log out"
3. **Expected:** Redirects to `/admin/login`

## Route Protection Summary

| Route | Protection | Redirects To |
|-------|-----------|--------------|
| `/admin` | ✅ Protected | `/admin/dashboard` |
| `/admin/login` | ❌ Public | - |
| `/admin/*` (all others) | ✅ Protected | `/admin/login` |
| `/` | ❌ Public | - |
| `/user` | ❌ Public | - |

## Important Notes

1. **All admin routes start with `/admin`** - This is enforced by the file structure in `app/admin/`

2. **Login page is public** - It's excluded from protection in both middleware and layout

3. **Double protection** - Both server-side (middleware) and client-side (AuthGuard) protection ensures security

4. **Redirect preservation** - When redirected to login, the original path is preserved in query params for redirect after login

5. **No breaking changes** - All existing functionality remains intact, just with added protection
