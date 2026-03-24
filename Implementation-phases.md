# Devicedock — SaaS Implementation Phases

> **Status**: DB migrations `001–015` applied in `supabase/example-migration/migrations`.  
> **Goal**: Multi-tenant SaaS with company-slug-based routing. Each company lives at `/{companySlug}/*`. You are the platform super admin at `/superadmin/*`.

---

## Architecture Overview

```
/                            → entry point → /login or /{slug}/dashboard
/login                       → company user login (generic, slug-free)
/signup                      → public multi-step company onboarding
/[companySlug]/dashboard     → e.g. /lumetrix/dashboard
/[companySlug]/orders        → e.g. /lumetrix/orders
/[companySlug]/inventory     → e.g. /lumetrix/inventory
/[companySlug]/...           → all company routes are slug-scoped
/superadmin/login            → super admin login (secret URL, separate portal)
/superadmin/*                → super admin dashboard
/invite/[token]              → accept company invite link
/auth/callback               → Supabase auth callback
/auth/reset-password         → password reset (all roles)
```

### Why slug-based routing?

- Each company gets their own URL namespace — `/lumetrix/*` vs `/acme/*`.
- If a user is accidentally authenticated into the wrong company, the URL makes it immediately obvious.
- Follows the same pattern as Linear, Vercel, Notion, Slack.
- In Next.js App Router, `app/[companySlug]/layout.tsx` is the perfect place to validate tenant access server-side before rendering any page.

### Next.js route priority — no conflicts

Next.js static routes always win over dynamic segments:

```
/login         → app/login/page.tsx          (static, wins over [companySlug])
/signup        → app/signup/page.tsx          (static, wins over [companySlug])
/superadmin/*  → app/superadmin/...           (static, wins over [companySlug])
/invite/*      → app/invite/[token]/page.tsx  (static, wins over [companySlug])
/auth/*        → app/auth/...                 (static, wins over [companySlug])
/lumetrix/*    → app/[companySlug]/...        (dynamic, caught by slug segment)
```

### Role Model (from DB)

| Role | Where stored | Access |
|---|---|---|
| `super_admin` | `platform_super_admins.user_id` | All companies, all data |
| `owner` | `company_users.role` | Their company only, full control |
| `manager` | `company_users.role` | Their company, limited control |
| `inventory_admin` | `company_users.role` | Inventory + orders only |
| `analyst` | `company_users.role` | Read-only company data |

### Key Tables Already in DB

- `platform_super_admins` — super admin registry
- `companies` — tenant companies (has `slug` column)
- `company_users` — user ↔ company membership + role
- `company_registrations` — pending signups
- `company_invitations` — pending invites
- `company_settings` — per-company settings (logo, preferences, etc.)
- `feature_catalog` — what features exist
- `role_feature_defaults` — default permissions per role
- `company_user_feature_overrides` — per-user feature permission overrides
- `inventory` — tenant-scoped (has `company_id`)
- `orders` — tenant-scoped (has `company_id`)
- `tax_rates` — global lookup table

---

## Route Map (Full — Before vs After)

### Current state (broken for SaaS)

| Route | Behaviour now |
|---|---|
| `/` | Hardcoded redirect to `/admin/login` |
| `/admin/login` | Login — checks `user_profiles.role = 'admin'` after sign-in |
| `/admin/*` | Protected; no company scoping |
| `/auth/callback` | After confirm → `/admin/login` |
| `/auth/reset-password` | Password reset |

### Target state (slug-based multi-tenant)

| Route | Who can access | Behaviour |
|---|---|---|
| `/` | Everyone | Smart redirect — see decision tree below |
| `/login` | Public | Company user login |
| `/signup` | Public | Multi-step company onboarding |
| `/[companySlug]/*` | Active members of that company only | Tenant-scoped dashboard |
| `/superadmin/login` | Public (secret URL) | Super admin login |
| `/superadmin/*` | Super admin only | Full platform management |
| `/invite/[token]` | Public | Accept company invite |
| `/auth/callback` | Public | Supabase auth callback |
| `/auth/reset-password` | Public | Password reset |

### `/` decision tree

```
User visits /
  ├── No session → redirect /login
  └── Has session
        ├── In company_users (active) → redirect /{companySlug}/dashboard
        └── Not found (super admin visiting /) → redirect /login
```

> Super admin never lands on `/`. They go directly to `/superadmin/login`.

### `/auth/callback` decision tree (handles both roles)

```
After Supabase confirms session:
  ├── In platform_super_admins → redirect /superadmin/dashboard
  ├── In company_users (active) → redirect /{companySlug}/dashboard
  └── Fallback → redirect /login
```

### `[companySlug]` layout — server-side tenant guard (the critical piece)

Every page inside `app/[companySlug]/` goes through `app/[companySlug]/layout.tsx`.  
This server component:

1. Reads `params.companySlug`.
2. Queries `companies` table: `SELECT id FROM companies WHERE slug = :companySlug`.
3. If company not found → `redirect('/login')`.
4. Queries `company_users`: `SELECT role FROM company_users WHERE user_id = auth.uid() AND company_id = :companyId AND status = 'active'`.
5. If user not a member → `redirect('/login')`.
6. Passes `company` and `membership` to child pages via a server context or props.

This means the middleware does **not** need to validate slug membership — the layout handles it. Middleware only handles:
- Unauthenticated users hitting `[companySlug]/*` → redirect `/login`
- Unauthenticated users hitting `superadmin/*` → redirect `/superadmin/login`

### Files that implement routing

| File | What changes |
|---|---|
| `app/page.tsx` | Smart redirect: no session → `/login`, else query `company_users` → `/{slug}/dashboard` |
| `app/login/page.tsx` | **New** — generic login page (replaces `/admin/login`) |
| `app/[companySlug]/layout.tsx` | **New** — server-side tenant guard for all company routes |
| `src/lib/supabase/middleware.ts` | Simplified — only protects unauthenticated access, drops `user_profiles` checks entirely |
| `app/auth/callback/route.ts` | Smart redirect post-auth for both roles |

---

## Existing `app/admin/*` pages — what happens to them

All pages under `app/admin/` move to `app/[companySlug]/`:

| Old route | New route | File to move |
|---|---|---|
| `/admin/dashboard` | `/[companySlug]/dashboard` | `app/admin/dashboard/` → `app/[companySlug]/dashboard/` |
| `/admin/inventory` | `/[companySlug]/inventory` | `app/admin/inventory/` → `app/[companySlug]/inventory/` |
| `/admin/products` | `/[companySlug]/products` | `app/admin/products/` → `app/[companySlug]/products/` |
| `/admin/upload-products` | `/[companySlug]/upload-products` | `app/admin/upload-products/` → `app/[companySlug]/upload-products/` |
| `/admin/orders` | `/[companySlug]/orders` | `app/admin/orders/` → `app/[companySlug]/orders/` |
| `/admin/orders/[id]/invoice` | `/[companySlug]/orders/[id]/invoice` | move nested |
| `/admin/users` | `/[companySlug]/users` | `app/admin/users/` → `app/[companySlug]/users/` |
| `/admin/reports` | `/[companySlug]/reports` | `app/admin/reports/` → `app/[companySlug]/reports/` |
| `/admin/hst` | `/[companySlug]/hst` | `app/admin/hst/` → `app/[companySlug]/hst/` |
| `/admin/settings` | `/[companySlug]/settings` | `app/admin/settings/` → `app/[companySlug]/settings/` |
| `/admin/alerts` | `/[companySlug]/alerts` | `app/admin/alerts/` → `app/[companySlug]/alerts/` |

The `app/admin/layout.tsx` becomes `app/[companySlug]/layout.tsx` (rewired to tenant guard).  
The page-level components in `src/page-components/` do not move — only the route wrappers move.

---

## Phase 1 — Foundation: Types + Auth Helpers + Context + Routing

**Goal**: Establish tenant-aware auth layer. Get routing working end-to-end before touching any page UI.

### 1.1 — TypeScript types

**File**: `src/types/company.ts` *(new file)*

```ts
export type CompanyRole = 'owner' | 'manager' | 'inventory_admin' | 'analyst';
export type MembershipStatus = 'active' | 'suspended' | 'pending';

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string | null;
  currency: string | null;
  created_at: string;
}

export interface CompanyMembership {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  status: MembershipStatus;
}
```

**File**: `src/lib/database.types.ts` *(modify)*

Add row types for: `companies`, `company_users`, `platform_super_admins`, `company_registrations`, `company_invitations`, `feature_catalog`, `role_feature_defaults`, `company_user_feature_overrides`.

### 1.2 — Server auth helpers

**File**: `src/lib/supabase/auth-helpers.ts` *(new file)*

```ts
// All run server-side only (use createClient from server)

ensureSuperAdmin(): Promise<NextResponse | null>
// checks platform_super_admins for auth.uid(); returns 401/403 if not found

ensureCompanyMember(companyId: string, allowedRoles: CompanyRole[]): Promise<NextResponse | null>
// checks company_users for auth.uid() + companyId + role in allowedRoles + status=active

getCompanyBySlug(slug: string): Promise<Company | null>
// SELECT * FROM companies WHERE slug = slug

getUserMembership(userId: string): Promise<{ company: Company; membership: CompanyMembership } | null>
// SELECT company_users JOIN companies WHERE user_id = userId AND status = 'active' LIMIT 1
```

### 1.3 — Company context (client-side)

**File**: `src/contexts/CompanyContext.tsx` *(new file)*

```ts
interface CompanyContextType {
  company: Company | null
  membership: CompanyMembership | null
  isSuperAdmin: boolean
  isOwner: boolean
  isLoading: boolean
  refreshCompany: () => Promise<void>
}
```

- Loads after auth user is resolved.
- Checks `platform_super_admins` first (sets `isSuperAdmin = true` if found).
- Otherwise fetches `company_users` JOIN `companies`.

**File**: `src/components/providers/Providers.tsx` *(modify)*

Add `CompanyProvider` around children inside `UserProfileProvider`.

### 1.4 — Update routing layer

**File 1**: `app/page.tsx` *(modify)*

Replace hardcoded `redirect("/admin/login")` with:

```ts
// Server component — can use createClient()
const { user } = await supabase.auth.getUser();
if (!user) redirect('/login');

const membership = await getUserMembership(user.id);
if (membership) redirect(`/${membership.company.slug}/dashboard`);

redirect('/login');
```

**File 2**: `src/lib/supabase/middleware.ts` *(modify)*

Simplified — remove all `user_profiles` checks. New logic:

```
Static public routes (always allow):
  /login, /signup, /superadmin/login, /invite/*, /auth/*, /not-found

/superadmin/* (excluding /superadmin/login):
  → No session → redirect /superadmin/login
  → (slug validation done in layout, not here)

/[companySlug]/* (any other multi-segment path not matching statics):
  → No session → redirect /login
  → Has session → let layout.tsx do the slug/membership validation

/ (root):
  → No session → redirect /login
  → Has session → redirect / (let app/page.tsx handle slug lookup)
```

**File 3**: `app/[companySlug]/layout.tsx` *(new file — the real guard)*

```ts
// Server component
export default async function CompanyLayout({ params, children }) {
  const { companySlug } = params;
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const company = await getCompanyBySlug(companySlug);
  if (!company) redirect('/login');  // slug doesn't exist

  const { data: membership } = await supabase
    .from('company_users')
    .select('*')
    .eq('user_id', user.id)
    .eq('company_id', company.id)
    .eq('status', 'active')
    .single();

  if (!membership) redirect('/login');  // user not a member

  // Render layout with sidebar, navbar etc.
  return <AdminShell company={company} membership={membership}>{children}</AdminShell>;
}
```

**File 4**: `app/auth/callback/route.ts` *(modify)*

```ts
// Post-auth smart redirect
1. Check platform_super_admins → /superadmin/dashboard
2. Call getUserMembership(userId) → /{slug}/dashboard
3. Fallback → /login
```

**File 5**: `app/login/page.tsx` *(new file)*

Move existing `/admin/login` page here. Update post-login redirect to use `/{slug}/dashboard`.

**File 6**: Rename `app/admin/` routes to `app/[companySlug]/`

Move all files from `app/admin/` into `app/[companySlug]/`.  
Keep `app/admin/` temporarily as redirects if needed, then delete in Phase 7.

### Files changed in Phase 1

| Action | File | What changes |
|---|---|---|
| **Modify** | `app/page.tsx` | Slug-based smart redirect |
| **Create** | `app/login/page.tsx` | Generic company login (moved from `/admin/login`) |
| **Create** | `app/[companySlug]/layout.tsx` | Server-side tenant guard |
| **Rename** | `app/admin/*` → `app/[companySlug]/*` | All company pages move to slug-scoped folder |
| **Modify** | `src/lib/supabase/middleware.ts` | Simplified — drop `user_profiles`, add slug route pattern |
| **Modify** | `app/auth/callback/route.ts` | Smart redirect for both roles |
| Create | `src/types/company.ts` | TypeScript types |
| Create | `src/lib/supabase/auth-helpers.ts` | Server auth utility functions |
| Create | `src/contexts/CompanyContext.tsx` | Client tenant context |
| Create | src/lib/supabase/client/admin.ts | Service role Supabase client (server-only, bypasses RLS) |
| Modify | `src/components/providers/Providers.tsx` | Add `CompanyProvider` |
| Modify | `src/lib/database.types.ts` | Add new table types |

---

## Phase 2 — Signup Flow (Company Onboarding)

**Goal**: Multi-step public signup at `/signup`. On submit: creates auth user + company + owner membership atomically. Redirects to `/{slug}/dashboard` after success.

### 2.1 — Signup page

**File**: `app/signup/page.tsx` *(new file)*  
**File**: `src/page-components/CompanySignup.tsx` *(new file)*

```
Route:   /signup
Public:  yes
Layout:  standalone (no sidebar)
```

Multi-step form:

```
Step 1 — Your Details
  First name, last name, email, phone, password, confirm password

Step 2 — Company Details
  Company name (auto-generates slug preview)
  Address, country, province/state, timezone, currency
  Years in business, company website (optional), company email

Step 3 — Review & Confirm
  Summary card of all details
  "Agree to terms" checkbox
  Submit button
```

### 2.2 — Signup API route

**File**: `app/api/auth/company-signup/route.ts` *(new file)*

Uses **service role client** (bypasses RLS):

1. Validate inputs (email unique, slug unique).
2. `supabase.auth.admin.createUser({ email, password, email_confirm: true })`.
3. Insert into `companies` (name, slug, status='active', timezone, currency).
4. Insert into `company_users` (role='owner', status='active').
5. Insert default `company_settings` row.
6. Sign the user in with `supabase.auth.signInWithPassword()`.
7. Return `{ slug }` to the frontend.
8. Frontend redirects to `/{slug}/dashboard`.

### 2.3 — Slug utility

**File**: `src/lib/utils/slug.ts` *(new file)*

```ts
generateSlug(companyName: string): string
// "Lumetrix Corp" → "lumetrix-corp"
// Strips special chars, lowercases, replaces spaces with hyphens

isSlugAvailable(slug: string): Promise<boolean>
// SELECT count(*) FROM companies WHERE slug = slug
```

### Files changed in Phase 2

| Action | File |
|---|---|
| Create | `app/signup/page.tsx` |
| Create | `src/page-components/CompanySignup.tsx` |
| Create | `src/components/forms/ReviewStep.tsx` |
| Create | `app/api/auth/company-signup/route.ts` |
| Create | `src/lib/utils/slug.ts` |

---

## Phase 3 — Company Login Logic

**Goal**: Ensure the `/login` page (created in Phase 1) routes company users to `/{slug}/dashboard` correctly after sign-in, and `AuthGuard` uses the new company-based role checks.

> **Note**: `app/login/page.tsx` is created in Phase 1 as a structural file. Phase 3 is where the **internal post-login logic** gets fully wired up to `CompanyContext` and tested end-to-end.

### 3.1 — Wire up `Login.tsx` post-login redirect

**File**: `src/page-components/Login.tsx` *(adapted from `AdminLogin.tsx` in Phase 1)*

Confirm post-sign-in logic is:

```
On sign in success:
  1. Call getUserMembership(user.id)
  2. Found → redirect /{membership.company.slug}/dashboard
  3. Not found → show error "No account found. Contact your administrator or sign up."
  4. Sign out user if no membership found
```

Add link to `/signup` at the bottom: "Register your company →"

### 3.2 — Auth callback

Already implemented in Phase 1, File 4. Verify it works correctly in this phase.

### 3.3 — Update `AuthGuard.tsx`

**File**: `src/lib/auth/AuthGuard.tsx` *(modify)*

- Default unauthenticated redirect: `/login` (was `/admin/login`).
- Super admin guard: checks `isSuperAdmin` from `CompanyContext`.
- Company guard: checks `membership !== null && membership.status === 'active'`.

### Files changed in Phase 3

| Action | File |
|---|---|
| Modify | `src/page-components/Login.tsx` (post-login redirect logic) |
| Modify | `src/lib/auth/AuthGuard.tsx` |

---

## Phase 4 — Tenant-Scope All Dashboard Data

**Goal**: All data queries filtered by `company_id` derived from the URL slug. No cross-tenant reads possible.

### 4.1 — `CompanyContext` supplies `company_id`

After Phase 1, `useCompany()` provides `company.id` and `company.slug` to all client components.  
All queries and API calls read `company_id` from this context — never from URL directly on the client.

### 4.2 — Update Supabase queries

Add `.eq('company_id', companyId)` to every query:

```
src/lib/supabase/queries/orders.ts
src/lib/supabase/queries/inventory.ts
src/lib/supabase/queries/stats.ts
src/lib/supabase/queries/users.ts
```

All functions take `companyId: string` as first parameter.

### 4.3 — Update contexts

**`src/contexts/OrdersContext.tsx`** *(modify)*  
Read `companyId` from `useCompany()`. Pass to all order queries.

**`src/contexts/InventoryContext.tsx`** *(modify)*  
Read `companyId` from `useCompany()`. Pass to all inventory queries.

### 4.4 — Update `Dashboard.tsx`

**File**: `src/page-components/Dashboard.tsx` *(modify)*

- `fetchInventoryStats(companyId)` and `fetchOrderStats(companyId)`.
- Show `company.name` in the header.

### 4.5 — Update `Navbar.tsx`

**File**: `src/components/layout/Navbar.tsx` *(modify)*

Show `company.name` + user's role badge. The slug-based URL already makes it clear which company you're in.

### 4.6 — Update `Settings.tsx`

**File**: `src/page-components/Settings.tsx` *(modify)*

Load/save `company_settings` filtered by `company.id`.  
Storage path: `company-logos/{companyId}/logo.{ext}`.

### 4.7 — Update API routes

All API routes replace `ensureAdmin()` with `ensureCompanyMember(companyId, allowedRoles)`.  
`companyId` is passed in the request body or derived from the slug in the URL.

### 4.8 — Update internal navigation links

All `router.push('/admin/...')` or `href="/admin/..."` references must become `/{companySlug}/...`.  
Use a hook `useCompanyRoute()` that prepends the slug automatically:

**File**: `src/hooks/useCompanyRoute.ts` *(new file)*

```ts
const useCompanyRoute = () => {
  const { company } = useCompany();
  const companyRoute = (path: string) => `/${company?.slug}${path}`;
  return { companyRoute };
};
// Usage: companyRoute('/orders') → '/lumetrix/orders'
```

### Files changed in Phase 4

| Action | File |
|---|---|
| Create | `src/hooks/useCompanyRoute.ts` |
| Modify | `src/lib/supabase/queries/orders.ts` |
| Modify | `src/lib/supabase/queries/inventory.ts` |
| Modify | `src/lib/supabase/queries/stats.ts` |
| Modify | `src/lib/supabase/queries/users.ts` |
| Modify | `src/contexts/OrdersContext.tsx` |
| Modify | `src/contexts/InventoryContext.tsx` |
| Modify | `src/page-components/Dashboard.tsx` |
| Modify | `src/page-components/Settings.tsx` |
| Modify | `src/components/layout/Navbar.tsx` |
| Modify | `src/components/layout/AppSidebar.tsx` |
| Modify | `app/api/admin/fulfill-order/route.ts` |
| Modify | `app/api/admin/inventory-colors/route.ts` |
| Modify | `app/api/admin/order-color-assignments/route.ts` |
| Modify | `app/api/users/delete/route.ts` |
| Modify | `app/api/users/emails/route.ts` |

---

## Phase 5 — Super Admin Dashboard

**Goal**: You log in at `/superadmin/login`. See all companies. Completely isolated from company routes.

### 5.1 — Super admin login page

**File**: `app/superadmin/login/page.tsx` *(new file)*  
**File**: `src/page-components/SuperAdminLogin.tsx` *(new file)*

- Same UX as `/login` but checks `platform_super_admins` after sign-in.
- On success → `/superadmin/dashboard`.
- No "Register company" link.
- `ShieldCheck` icon + "Super Admin" title.

### 5.2 — Super admin layout

**File**: `app/superadmin/layout.tsx` *(new file)*

Server component — validates `platform_super_admins` row. Redirects to `/superadmin/login` if not found.  
Renders `SuperAdminSidebar` + `SuperAdminNavbar`.

### 5.3 — Super admin sidebar

**File**: `src/components/layout/SuperAdminSidebar.tsx` *(new file)*

```
Dashboard    /superadmin/dashboard
Companies    /superadmin/companies
Settings     /superadmin/settings
```

### 5.4 — Super admin dashboard

**File**: `app/superadmin/dashboard/page.tsx` *(new file)*  
**File**: `src/page-components/SuperAdminDashboard.tsx` *(new file)*

Stats:
- Total companies (active / inactive)
- Total users across platform
- New companies this month

### 5.5 — Companies list

**File**: `app/superadmin/companies/page.tsx` *(new file)*  
**File**: `src/page-components/SuperAdminCompanies.tsx` *(new file)*

Table: Company Name | Slug | Status | Owner Email | Users | Created | Actions  
Actions: View, Activate/Deactivate, Delete

### 5.6 — Company detail

**File**: `app/superadmin/companies/[companyId]/page.tsx` *(new file)*  
**File**: `src/page-components/SuperAdminCompanyDetail.tsx` *(new file)*

Shows company info, owner, all users + roles. Can activate/deactivate or reset owner password.

### 5.7 — Super admin API routes

```
app/api/superadmin/companies/route.ts              GET list, POST create
app/api/superadmin/companies/[companyId]/route.ts  GET detail, PATCH update, DELETE
app/api/superadmin/companies/[companyId]/users/route.ts  GET all users
```

All use `ensureSuperAdmin()`.

### 5.8 — Super admin Navbar

**File**: `src/components/layout/SuperAdminNavbar.tsx` *(new file)*

Shows "Super Admin" badge + logout.

### Files changed in Phase 5

| Action | File |
|---|---|
| Create | `app/superadmin/login/page.tsx` |
| Create | `app/superadmin/layout.tsx` |
| Create | `app/superadmin/dashboard/page.tsx` |
| Create | `app/superadmin/companies/page.tsx` |
| Create | `app/superadmin/companies/[companyId]/page.tsx` |
| Create | `src/page-components/SuperAdminLogin.tsx` |
| Create | `src/page-components/SuperAdminDashboard.tsx` |
| Create | `src/page-components/SuperAdminCompanies.tsx` |
| Create | `src/page-components/SuperAdminCompanyDetail.tsx` |
| Create | `src/components/layout/SuperAdminSidebar.tsx` |
| Create | `src/components/layout/SuperAdminNavbar.tsx` |
| Create | `app/api/superadmin/companies/route.ts` |
| Create | `app/api/superadmin/companies/[companyId]/route.ts` |
| Create | `app/api/superadmin/companies/[companyId]/users/route.ts` |
| Modify | `src/lib/auth/AuthGuard.tsx` (add `requireSuperAdmin` prop) |

---

## Phase 6 — Company User Invite + Permission Management

**Goal**: Company owners invite users. Per-user feature access is managed via a Team page.

### 6.1 — Add Team to sidebar

**File**: `src/components/layout/AppSidebar.tsx` *(modify)*

```
Team    /{companySlug}/team    (Users icon)
```

Visible only when `membership.role === 'owner'` or has `manage_users` feature.

### 6.2 — Team management page

**File**: `app/[companySlug]/team/page.tsx` *(new file)*  
**File**: `src/page-components/TeamManagement.tsx` *(new file)*

**Tab 1 — Members**: Name | Email | Role | Status | Actions (Edit role, Suspend, Remove)  
**Tab 2 — Invitations**: Email | Role | Sent | Expires | Status | Actions (Resend, Cancel)  
**Tab 3 — Permissions**: Per-user feature override table

### 6.3 — Invite user modal

**File**: `src/components/modals/InviteUserModal.tsx` *(new file)*

Fields: email, role (manager / inventory_admin / analyst).

### 6.4 — Invite API

**File**: `app/api/company/invite/route.ts` *(new file)*

Protected: `ensureCompanyMember(companyId, ['owner'])`.  
Generates token, inserts `company_invitations`, sends invite email.

### 6.5 — Accept invite page

**File**: `app/invite/[token]/page.tsx` *(new file)*  
**File**: `src/page-components/AcceptInvite.tsx` *(new file)*

Validates token, shows company + role. On confirm: creates user + `company_users` row → redirect `/{slug}/dashboard`.

### 6.6 — Permission API

**File**: `app/api/company/permissions/[userId]/route.ts` *(new file)*

Returns effective permissions by merging `role_feature_defaults` + `company_user_feature_overrides`.

### Files changed in Phase 6

| Action | File |
|---|---|
| Create | `app/[companySlug]/team/page.tsx` |
| Create | `app/invite/[token]/page.tsx` |
| Create | `src/page-components/TeamManagement.tsx` |
| Create | `src/page-components/AcceptInvite.tsx` |
| Create | `src/components/modals/InviteUserModal.tsx` |
| Create | `app/api/company/invite/route.ts` |
| Create | `app/api/company/permissions/[userId]/route.ts` |
| Modify | `src/components/layout/AppSidebar.tsx` |

---

## Phase 7 — Cleanup + Polish

### 7.1 — Delete legacy `app/admin/` page folder

> **Important distinction**: There are two separate `admin` folders — do not confuse them.
> - `app/admin/` — **page routes** (dashboard, orders, inventory, etc.) → **delete this entirely** in Phase 7.
> - `app/api/admin/` — **API route handlers** (fulfill-order, inventory-colors, etc.) → **keep this, only modify the auth logic** inside each file.

Once all pages are running under `app/[companySlug]/`:
- Delete `app/admin/` (page routes folder) entirely.
- Also add a catch-all redirect inside the deleted routes during the transition: `app/admin/login/page.tsx` should temporarily `redirect('/login')` until Phase 7 cleanup so old bookmarks don't 404.
- Remove all `/admin/*` href and `router.push` references from internal navigation (replaced by `useCompanyRoute()`).

### 7.2 — Remove legacy files

- `src/contexts/WishlistContext.tsx`
- `src/contexts/WishesContext.tsx`
- `src/contexts/CartContext.tsx`
- `src/components/modals/PurchaseModal.tsx`
- `src/components/sections/HowItWorksSection.tsx`
- `app/api/wishes/*`

### 7.3 — Remove old providers

Remove `CartProvider`, `WishlistProvider`, `WishesProvider` from `Providers.tsx`.

### 7.4 — Remove `isAdmin` flag from `UserProfileContext`

Now fully replaced by `CompanyContext.membership.role`.

### 7.5 — Delete old migration folder

Delete `supabase/migrations/` after all `example-migration` files verified applied.

### 7.6 — Final RLS verification

```sql
-- Verify inventory is scoped per company
SELECT company_id, count(*) FROM inventory GROUP BY company_id;

-- Verify orders is scoped per company
SELECT company_id, count(*) FROM orders GROUP BY company_id;

-- Should return only your company rows when queried as a normal user (RLS active)
SELECT * FROM inventory;
SELECT * FROM orders;
```

---

## Implementation Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

**Do not start Phase 4 before Phase 1 is complete** — `CompanyContext` must exist before any query can read `company_id`.  
**Phase 5 can be done in parallel with Phase 4** — it's a fully independent route namespace.

---

## DB Migration Status

> ⚠️ **DO NOT run migrations from code or scripts.** All migrations are run manually by the developer directly in the Supabase SQL editor. Never automate or trigger migration execution during implementation — always leave this to be done manually.

All migrations `001` through `015` have already been applied to the database.

| # | File | Status |
|---|---|---|
| 001 | `001_init_tenancy_auth.sql` | ✅ Applied |
| 002 | `002_seed_feature_catalog.sql` | ✅ Applied |
| 003 | `003_company_registrations_add_tax_context.sql` | ✅ Applied |
| 004 | `004_companies_rls.sql` | ✅ Applied |
| 005 | `005_extend_company_registrations.sql` | ✅ Applied |
| 006 | `006_create_company_scoped_inventory_orders.sql` | ✅ Applied |
| 007 | `007_add_order_rejection_fields.sql` | ✅ Applied |
| 008 | `008_expand_inventory_grades.sql` | ✅ Applied |
| 009 | `009_create_tax_rates.sql` | ✅ Applied |
| 010 | `010_seed_tax_rates.sql` | ✅ Applied |
| 011 | `011_add_order_tax_fields.sql` | ✅ Applied |
| 012 | `012_add_order_invoice_fields.sql` | ✅ Applied |
| 013 | `013_add_order_discount_shipping_addresses_manual_sale.sql` | ✅ Applied |
| 014 | `014_add_inventory_pricing_and_flags.sql` | ✅ Applied |
| 015 | `015_backfill_purchase_price_and_drop_restore_trigger.sql` | ✅ Applied |

If new migrations are needed in future phases, they will be added to `supabase/example-migration/migrations/` as new numbered files and the developer will run them manually. The AI agent will only write the SQL file — never execute it.

After confirming all are applied: delete `supabase/migrations/` folder (the old legacy folder).

---

## Feature Permissions Reference

| Feature key | owner | manager | inventory_admin | analyst |
|---|---|---|---|---|
| `company_dashboard` | ✅ | ✅ | ✅ | ✅ |
| `manage_users` | ✅ | ❌ | ❌ | ❌ |
| `manage_feature_permissions` | ✅ | ❌ | ❌ | ❌ |

---

## Notes

- **Super admin seeding** (one-time, run in Supabase SQL editor after creating your account):
  ```sql
  INSERT INTO platform_super_admins (user_id) VALUES ('<your-auth-user-id>');
  ```

- **`/superadmin/login` is intentionally unlisted** — it is not linked anywhere in the company-facing UI. Only you know it exists.

- **Slug reserved words** — in `generateSlug()`, block these slugs from being registered:
  `login`, `signup`, `superadmin`, `invite`, `auth`, `api`, `not-found`, `_next`

- **Service role client** — used in signup, invite, and superadmin APIs only. Never expose to browser. Lives in `src/lib/supabase/client/admin.ts`.

- **RLS is always on** — client-side reads always go through RLS. The `[companySlug]/layout.tsx` guard + RLS together make cross-tenant reads impossible.

- **Old migrations folder** — `supabase/migrations/` is archived. Do not run. Remove after verification.
