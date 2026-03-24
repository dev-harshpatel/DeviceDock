# Stoq — Complete Project Onboarding Guide

> This guide is intended for developers joining the Stoq project for the first time.
> Read it top to bottom — each section builds on the previous one.
> Last updated: March 2026

---

## Table of Contents

1. [What Is Stoq?](#1-what-is-stoq)
2. [Tech Stack](#2-tech-stack)
3. [Local Setup](#3-local-setup)
4. [Project Folder Structure](#4-project-folder-structure)
5. [Environment Variables](#5-environment-variables)
6. [Database & Migrations](#6-database--migrations)
7. [Authentication & Roles](#7-authentication--roles)
8. [Core Data Types](#8-core-data-types)
9. [Supabase Query Patterns](#9-supabase-query-patterns)
10. [State Management](#10-state-management)
11. [UI Patterns & Components](#11-ui-patterns--components)
12. [Forms & Validation](#12-forms--validation)
13. [Routing & Route Protection](#13-routing--route-protection)
14. [API Routes](#14-api-routes)
15. [Coding Rules & Conventions](#15-coding-rules--conventions)
16. [Adding a New Feature — Step-by-Step](#16-adding-a-new-feature--step-by-step)
17. [Git Workflow](#17-git-workflow)
18. [Deployment](#18-deployment)
19. [Troubleshooting](#19-troubleshooting)
20. [Where to Find Things](#20-where-to-find-things)

---

## 1. What Is Stoq?

**Stoq** is a B2B inventory and order management platform for **Hari Om Traders Ltd.** (b2bmobiles.ca), a mobile device supplier based in Brampton, ON.

**What it does:**
- Admin staff manage inventory (phones by brand/grade/storage), process orders, generate invoices, and view analytics
- Approved business buyers (users) browse inventory, add to cart, place orders, and track their purchases
- The system handles tax (HST/GST), PDF invoice generation, bulk Excel imports, and demand forecasting

**Live URL:** b2bmobiles.ca
**Staging URL:** stoq-bice.vercel.app
**Repository branches:** `main` (production) ← `development` (staging) ← feature branches

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 (App Router) + TypeScript | All routing is file-based under `app/` |
| Styling | Tailwind CSS v4 | Custom color tokens defined in `tailwind.config.ts` |
| UI Components | shadcn/ui + Radix UI | Components live in `src/components/ui/` |
| Icons | Lucide React | `import { IconName } from "lucide-react"` |
| Database | Supabase (PostgreSQL) | Row-Level Security (RLS) enforced |
| Auth | Supabase Auth (email/password) | Session managed via middleware |
| Server State | TanStack React Query v5 | Paginated queries, cache invalidation |
| Client State | React Context | One context per domain (inventory, cart, orders, etc.) |
| Forms | React Hook Form + Zod | Schema-first validation |
| Toasts | Sonner | `toast.success()` / `toast.error()` |
| PDF Export | @react-pdf/renderer + jsPDF | Invoices use react-pdf, reports use jsPDF |
| Excel | xlsx | Bulk product import/export |
| Charts | Recharts | Dashboard and reports pages |
| Hosting | Vercel | Auto-deploys from `main` |

---

## 3. Local Setup

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier is fine for dev)

### Steps

```bash
# 1. Clone the repo
git clone <repo-url>
cd stoq

# 2. Install dependencies
npm install

# 3. Copy env template and fill in your Supabase credentials
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
# 4. Run migrations (see Section 6 for the SAFE way to do this)
# Run each SQL file manually in Supabase SQL Editor (001 → 039)

# 5. Seed the database with demo data
npm run seed

# 6. Start the dev server
npm run dev
```

Open http://localhost:3000

**Test credentials (after seeding):**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@stoq.com | admin123 |
| User | user1@example.com | user123 |
| User | user2@example.com | user123 |

Admin panel: http://localhost:3000/admin/login

---

## 4. Project Folder Structure

```
stoq/
├── app/                        # Next.js App Router (pages & API routes)
│   ├── layout.tsx              # Root layout — wraps entire app in <Providers>
│   ├── page.tsx                # Public homepage (product listing)
│   ├── admin/                  # Admin-only area
│   │   ├── layout.tsx          # Admin layout with AuthGuard
│   │   ├── login/              # Admin login page (public)
│   │   ├── dashboard/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── users/
│   │   ├── demand/
│   │   ├── reports/
│   │   ├── hst/
│   │   ├── alerts/
│   │   ├── settings/
│   │   └── upload-products/
│   ├── user/                   # Authenticated user area
│   │   ├── orders/
│   │   ├── profile/
│   │   ├── wishlist/
│   │   ├── wishes/
│   │   └── stats/
│   ├── auth/                   # Auth callback, reset-password, error pages
│   ├── api/                    # Next.js API routes (server-side)
│   │   ├── auth/
│   │   ├── user-profile/
│   │   ├── users/
│   │   └── wishes/
│   └── contact/
│
├── src/
│   ├── components/             # Shared React components
│   │   ├── ui/                 # shadcn/ui primitives (Button, Dialog, Input, etc.)
│   │   ├── Providers.tsx       # Nests all Context + QueryClient providers
│   │   ├── UserNavbar.tsx      # Top navigation bar
│   │   ├── AppLayout.tsx       # Admin shell (sidebar + content)
│   │   ├── AppSidebar.tsx      # Admin sidebar navigation
│   │   ├── FilterBar.tsx       # Search + filter bar for inventory
│   │   ├── InventoryTable.tsx  # Product table
│   │   ├── CartModal.tsx       # Cart drawer
│   │   ├── AddProductModal.tsx # Admin: add/restock product
│   │   └── [50+ other modals and feature components]
│   │
│   ├── page-components/        # Full-page components (rendered by app/ pages)
│   │   ├── Inventory.tsx       # Admin inventory page logic
│   │   ├── Orders.tsx
│   │   ├── Dashboard.tsx
│   │   └── [12+ others]
│   │
│   ├── contexts/               # React Context providers (one per domain)
│   │   ├── InventoryContext.tsx
│   │   ├── CartContext.tsx
│   │   ├── OrdersContext.tsx
│   │   ├── UserProfileContext.tsx
│   │   ├── WishlistContext.tsx
│   │   ├── WishesContext.tsx
│   │   ├── StockRequestContext.tsx
│   │   ├── RealtimeContext.tsx
│   │   └── NavigationContext.tsx
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── context.tsx     # AuthContext + useAuth hook
│   │   │   └── AuthGuard.tsx   # Route protection component
│   │   ├── supabase/
│   │   │   ├── client/
│   │   │   │   ├── browser.ts  # createBrowserClient() — use in components/hooks
│   │   │   │   ├── server.ts   # createServerClient() — use in Server Components & API routes
│   │   │   │   └── admin.ts    # createAdminClient() — service role, bypasses RLS
│   │   │   ├── queries/        # All DB query functions
│   │   │   │   ├── inventory.ts
│   │   │   │   ├── orders.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── wishes.ts
│   │   │   │   ├── mappers.ts  # DB row → TypeScript type converters
│   │   │   │   └── index.ts
│   │   │   ├── utils.ts        # User profile CRUD helpers
│   │   │   └── middleware.ts   # Session refresh middleware helper
│   │   ├── constants/
│   │   │   ├── index.ts        # App-wide constants (company name, debounce ms, etc.)
│   │   │   ├── grades.ts       # Grade definitions and badge labels
│   │   │   └── toast-messages.ts # All toast copy in one place
│   │   ├── utils/
│   │   │   ├── index.ts        # cn() utility (classnames merge)
│   │   │   ├── formatters.ts   # formatPrice(), formatDate()
│   │   │   ├── order.ts        # Order logic helpers
│   │   │   └── status.ts       # getStatusColor(), getStatusLabel()
│   │   ├── validations/        # Zod schemas for forms
│   │   ├── export/             # Excel and PDF export utilities
│   │   ├── invoice/            # Invoice PDF generation
│   │   ├── tax/                # HST/tax calculation helpers
│   │   ├── types/              # Supabase-generated + extended types
│   │   └── query-keys.ts       # TanStack Query key factory
│   │
│   ├── data/
│   │   └── inventory.ts        # InventoryItem type, calculatePricePerUnit(), formatPrice()
│   │
│   ├── types/                  # Domain TypeScript types
│   │   ├── user.ts             # UserRole, UserProfile, Address
│   │   ├── order.ts            # Order, OrderItem, OrderStatus
│   │   ├── wish.ts             # Wish, WishOffer
│   │   ├── invoice.ts          # Invoice fields
│   │   └── stockRequest.ts     # StockRequest
│   │
│   └── hooks/                  # Custom React hooks
│       ├── use-paginated-react-query.ts
│       ├── use-debounce.ts
│       ├── use-page-param.ts
│       ├── use-filter-options.ts
│       └── use-realtime-invalidation.ts
│
├── supabase/
│   ├── migrations/             # SQL migration files (001–039)
│   ├── scripts/                # migrate.ts, seed.ts, reset-inventory.ts
│   └── email-templates/        # Supabase Auth email templates
│
├── docs/                       # All documentation lives here
├── public/                     # Static assets
├── middleware.ts               # Next.js middleware (session refresh)
├── tailwind.config.ts
├── tsconfig.json               # Path alias: @/* → ./src/*
└── next.config.js
```

**Key rule:** App Router `page.tsx` files are thin — they import and render a component from `src/page-components/`. All real logic lives in `src/`.

---

## 5. Environment Variables

| Variable | Where used | Notes |
|----------|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Public key, safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (API routes) | Secret — never expose to browser |
| `NEXT_PUBLIC_SITE_URL` | Auth redirects | `http://localhost:3000` locally |
| `DATABASE_URL` | Migration script only | Optional, only needed for `npm run migrate` |

`NEXT_PUBLIC_*` variables are available in both client and server components. Variables without that prefix are server-only.

---

## 6. Database & Migrations

### Schema Overview

The database has 39 sequential migration files in `supabase/migrations/`. They must be applied in order (001 → 039).

**Core tables:**

```
auth.users              — Managed by Supabase Auth
public.user_profiles    — Extended user info (role, business details, addresses)
public.inventory        — Product catalog with pricing
public.orders           — Orders (items stored as JSONB)
public.tax_rates        — Province → tax rate/type mapping
public.company_settings — Key/value app config (tax region, payment methods, etc.)
public.wishlist_items   — User-saved inventory items
public.stock_requests   — Requests for out-of-stock items
public.product_uploads  — Upload history metadata
public.wishes           — Custom device requests with admin offers
```

### How to Run Migrations

> **CRITICAL: Never run `npm run migrate` on a database with existing data.**
> The migration runner has no awareness of which scripts have already been applied —
> it will re-run everything, including destructive DROP/CREATE statements.

**Safe method — run manually in Supabase SQL Editor:**

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of each migration file, in order
3. Start from the first migration you haven't applied yet

**For a brand-new local database:**

```bash
# Safe to use on empty DB only
npm run migrate

# Then seed with test data
npm run seed
```

### Adding a New Migration

1. Create a new file: `supabase/migrations/040_your_feature.sql`
2. Write your SQL (CREATE TABLE, ALTER TABLE, new RLS policies, etc.)
3. Share the SQL with the team — each person runs it manually in their Supabase SQL Editor

### Row-Level Security (RLS)

Every table has RLS enabled. This means:

- **Regular users** can only read/write their own rows
- **Admins** can read/write all rows
- **Sensitive inventory fields** (`purchase_price`, `price_per_unit`, `hst`) are hidden from non-admins via RLS

The admin check in RLS policies queries `user_profiles.role = 'admin'`. Migration `003_fix_rls_recursion.sql` is critical — it prevents infinite recursion in these policies.

See `docs/RLS_POLICIES_EXPLAINED.md` for a full breakdown.

---

## 7. Authentication & Roles

### Auth Flow

Authentication is handled by Supabase Auth (email + password).

```
User signs up
  → API route /api/auth/check-email verifies email isn't already taken
  → Supabase creates auth.users record
  → API route /api/user-profile/create creates user_profiles record
  → Email confirmation sent by Supabase

User logs in
  → src/lib/auth/context.tsx calls supabase.auth.signInWithPassword()
  → Checks email_confirmed_at — rejects unconfirmed accounts
  → onAuthStateChange updates the AuthContext globally
```

### The `useAuth()` Hook

```typescript
import { useAuth } from "@/lib/auth/context";

const { user, loading, signIn, signUp, signOut, resetPasswordForEmail } = useAuth();
```

`user` is the raw Supabase `User` object (has `id`, `email`, etc.).

### User Roles

```typescript
// src/types/user.ts
export type UserRole = 'user' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
```

Role and approval status live in `user_profiles`, not in `auth.users`.

To get the current user's profile and role:

```typescript
import { useUserProfile } from "@/contexts/UserProfileContext";

const { profile, isAdmin } = useUserProfile();
```

### Route Protection

`AuthGuard` (`src/lib/auth/AuthGuard.tsx`) wraps protected pages:

```typescript
// app/admin/layout.tsx already does this for all /admin/* routes
<AuthGuard requireAuth requireAdmin>
  {children}
</AuthGuard>
```

- `requireAuth` — redirect to login if not signed in
- `requireAdmin` — redirect to `/` if signed in but not admin

---

## 8. Core Data Types

### InventoryItem

```typescript
// src/data/inventory.ts
export interface InventoryItem {
  id: string;
  deviceName: string;
  brand: string;
  grade: Grade;           // "Brand New Sealed" | "Brand New Open Box" | "A" | "B" | "C" | "D"
  storage: string;        // e.g. "128GB", "256GB"
  quantity: number;
  pricePerUnit: number;   // Admin-only: cost per unit (including HST)
  purchasePrice?: number | null;  // Admin-only: total purchase cost for the batch
  hst?: number | null;    // Admin-only: HST % applied when calculating pricePerUnit
  sellingPrice: number;   // Public: what users see and pay
  lastUpdated: string;    // ISO date string
  priceChange?: "up" | "down" | "stable";
  isActive?: boolean;
}
```

**Important:** `purchasePrice` is the **total cost for the entire batch**, not per unit.

```typescript
// Price per unit formula:
export function calculatePricePerUnit(
  purchasePrice: number,  // total cost for ALL units
  quantity: number,
  hstPercent: number
): number {
  return Math.round((purchasePrice / quantity) * (1 + hstPercent / 100) * 100) / 100;
}
```

### Grade

```typescript
// src/lib/constants/grades.ts
export const GRADES = [
  "Brand New Sealed",
  "Brand New Open Box",
  "A", "B", "C", "D"
] as const;

export type Grade = typeof GRADES[number];
```

Badge labels: BNS, BNOB, A, B, C, D

### UserProfile

```typescript
// src/types/user.ts — 56 fields total, key ones:
export interface UserProfile {
  id: string;
  userId: string;           // matches auth.users.id
  role: UserRole;
  approvalStatus: ApprovalStatus;
  firstName: string;
  lastName: string;
  phone: string;
  businessName: string;
  businessAddress: string;
  // ... shipping and billing address fields
}
```

### Order

```typescript
// src/types/order.ts
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];       // [{ item: InventoryItem, quantity: number }]
  subtotal: number;
  taxAmount: number | null;
  totalPrice: number;
  status: OrderStatus;      // "pending" | "approved" | "rejected" | "completed"
  createdAt: string;
  // ... invoice fields, discount, shipping address, IMEI numbers
  isManualSale?: boolean;   // true for admin-recorded off-platform sales
}
```

---

## 9. Supabase Query Patterns

### Which Client to Use

| Context | Client | Import |
|---------|--------|--------|
| Client Components / hooks | `createBrowserClient()` | `@/lib/supabase/client/browser` |
| Server Components / API routes | `createServerClient()` | `@/lib/supabase/client/server` |
| Admin operations (bypasses RLS) | `createAdminClient()` | `@/lib/supabase/client/admin` |

```typescript
// In a client component or context:
import { createBrowserClient } from "@/lib/supabase/client/browser";
const supabase = createBrowserClient();

// In an API route (app/api/**/route.ts):
import { createServerClient } from "@/lib/supabase/client/server";
const supabase = createServerClient();

// In an admin API route (needs service role):
import { createAdminClient } from "@/lib/supabase/client/admin";
const supabase = createAdminClient();
```

### Query Functions

All database queries live in `src/lib/supabase/queries/`. Never write raw Supabase queries inline in components — always use or create a function in the queries folder.

```typescript
// src/lib/supabase/queries/inventory.ts
export async function fetchPaginatedInventory(
  supabase: SupabaseClient,
  { page, pageSize, search, brand, grade, storage }: InventoryQueryParams
): Promise<{ data: InventoryItem[]; count: number }> { ... }

export async function upsertInventoryItem(
  supabase: SupabaseClient,
  item: Partial<InventoryItem>
): Promise<InventoryItem> { ... }
```

### Mappers

DB column names use `snake_case`. TypeScript types use `camelCase`. All conversion happens in `src/lib/supabase/queries/mappers.ts`:

```typescript
// mappers.ts
export function mapInventoryRow(row: Database['public']['Tables']['inventory']['Row']): InventoryItem {
  return {
    id: row.id,
    deviceName: row.device_name,
    brand: row.brand,
    grade: row.grade as Grade,
    sellingPrice: row.selling_price,
    // ...
  };
}
```

Always use mappers — never access raw `snake_case` fields outside of the queries layer.

### Paginated Queries

Use the `usePaginatedReactQuery` hook for any list with pagination:

```typescript
import { usePaginatedReactQuery } from "@/hooks/use-paginated-react-query";
import { queryKeys } from "@/lib/query-keys";

const { data, totalCount, totalPages, isLoading } = usePaginatedReactQuery({
  queryKey: queryKeys.inventoryPage(currentPage, filters),
  fetchFn: (range) => fetchPaginatedInventory(supabase, { page: range.page, ...filters }),
  currentPage,
  setCurrentPage,
  filtersKey: JSON.stringify(filters),
});
```

### Cache Invalidation

After any mutation (create/update/delete), invalidate the relevant query:

```typescript
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const queryClient = useQueryClient();
await queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
```

The `queryKeys` factory is in `src/lib/query-keys.ts`. Add new keys there — never hardcode strings.

---

## 10. State Management

### Architecture

```
React Query (server/async state — lists, paginated data)
  +
React Context (client state — cart, auth session, UI state)
```

Use React Query for anything that comes from the database. Use Context for in-memory state that multiple components need to share (cart items, user profile, etc.).

### Context Provider Order

All providers are nested in `src/components/Providers.tsx`. The order matters — contexts that depend on others must come after:

```
QueryClientProvider
  AuthProvider                  ← auth must be first
    RealtimeProvider            ← realtime uses auth
      NavigationProvider
        UserProfileProvider     ← profile needs auth
          InventoryProvider
            CartProvider        ← cart needs inventory
              WishlistProvider
                WishesProvider
                  StockRequestProvider
                    OrdersProvider
```

### Adding a New Context

1. Create `src/contexts/YourFeatureContext.tsx`
2. Define the interface and `createContext`
3. Export a `useYourFeature()` hook that throws if used outside provider
4. Add the provider to `src/components/Providers.tsx` in the correct order

### Realtime Updates

`RealtimeContext` subscribes to Supabase realtime changes and automatically invalidates React Query caches. If you add a new table that needs realtime updates, add it to `RealtimeContext.tsx`.

---

## 11. UI Patterns & Components

### Tailwind CSS

Use Tailwind utility classes. Custom color tokens (defined in `tailwind.config.ts`):

```
text-primary, bg-primary         — primary brand color
text-muted-foreground            — subtle text
bg-destructive                   — red/error
bg-success                       — green/success
text-sidebar-foreground          — sidebar-specific
```

Always use `cn()` for conditional class merging:

```typescript
import { cn } from "@/lib/utils";

<div className={cn("base-class", isActive && "active-class", className)} />
```

### shadcn/ui Components

All primitive components are in `src/components/ui/`. Import from there:

```typescript
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

Never install new UI component libraries without discussion. Extend shadcn/ui components first.

### Modals

Use the `Dialog` component pattern:

```typescript
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Your Title</DialogTitle>
    </DialogHeader>
    {/* content */}
  </DialogContent>
</Dialog>
```

### Searchable Combobox (Command + Popover)

For searchable dropdowns, use the `Command` + `Popover` pattern — see `AddProductModal.tsx` for the full example.

### Toasts

```typescript
import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";

toast.success(TOAST_MESSAGES.ORDER_CREATED);
toast.error(TOAST_MESSAGES.GENERIC_ERROR, { description: "More detail here" });
```

Always use constants from `toast-messages.ts`. Never hardcode toast strings in components.

### Loading States

- Page-level loading: use `<Loader />` component
- Table loading: use `<TableSkeleton />` component
- Button loading: use `isLoading` state with `disabled` prop on the `<Button />`

---

## 12. Forms & Validation

All forms use **React Hook Form** + **Zod**. This is the required pattern — do not use uncontrolled forms or other validation libraries.

### Pattern

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// 1. Define schema (in src/lib/validations/ if reusable)
const schema = z.object({
  deviceName: z.string().min(1, "Device name is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  sellingPrice: z.number().positive("Price must be positive"),
});

type FormData = z.infer<typeof schema>;

// 2. Use in component
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
  resolver: zodResolver(schema),
});

// 3. Submit handler
const onSubmit = async (data: FormData) => {
  try {
    await saveToDatabase(data);
    toast.success(TOAST_MESSAGES.SAVE_SUCCESS);
    onClose();
  } catch {
    toast.error(TOAST_MESSAGES.GENERIC_ERROR);
  }
};
```

Reusable schemas live in `src/lib/validations/`. Create one file per domain (e.g., `src/lib/validations/inventory.ts`).

---

## 13. Routing & Route Protection

### Route Map

| Path | Access | Notes |
|------|--------|-------|
| `/` | Public | Product listing for all visitors |
| `/contact` | Public | |
| `/user/grades` | Public | Grade guide |
| `/auth/*` | Public | Callback, reset-password, error |
| `/admin/login` | Public | Admin-specific login page |
| `/user/orders` | Authenticated user | |
| `/user/profile` | Authenticated user | |
| `/user/wishlist` | Authenticated user | |
| `/user/wishes` | Authenticated user | |
| `/admin/*` | Admin only | Except `/admin/login` |

### How Protection Works

```
Request to /admin/inventory
  ↓
middleware.ts (Next.js middleware)
  → refreshes Supabase session cookies
  ↓
app/admin/layout.tsx
  → renders <AuthGuard requireAuth requireAdmin>
  ↓
AuthGuard checks:
  - If no session → redirect to /admin/login
  - If session but role !== 'admin' → redirect to /
  - If admin → render children
```

### Adding a New Protected Page

```typescript
// app/admin/new-feature/page.tsx
export default function NewFeaturePage() {
  return <NewFeaturePageComponent />;
  // Protected automatically by app/admin/layout.tsx
}

// app/user/new-feature/page.tsx
// For user-only pages, add AuthGuard in the layout or wrap the component:
import { AuthGuard } from "@/lib/auth/AuthGuard";
<AuthGuard requireAuth>{children}</AuthGuard>
```

---

## 14. API Routes

API routes live in `app/api/`. They are Next.js Route Handlers (not Pages Router API routes).

### Pattern

```typescript
// app/api/your-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/client/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // validate body...

    const supabase = createServerClient();
    // do DB work...

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
```

Use `createAdminClient()` only when you need to bypass RLS (e.g., creating a user profile during signup where the user doesn't exist yet in the DB).

### Existing API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/auth/check-email` | Pre-signup email check |
| `POST /api/user-profile/create` | Create user profile (bypasses RLS) |
| `POST /api/user-profile/update-approval-status` | Admin: approve/reject user |
| `GET /api/users/emails` | Admin: list all user emails |
| `POST /api/users/delete` | Admin: delete user |
| `POST /api/wishes/*` | Wish CRUD operations |

---

## 15. Coding Rules & Conventions

### DRY — Don't Repeat Yourself

- If you write the same logic twice, extract it into a utility function or hook
- DB queries belong in `src/lib/supabase/queries/`, not inline in components
- Toast messages belong in `src/lib/constants/toast-messages.ts`
- Query keys belong in `src/lib/query-keys.ts`
- Reusable form schemas belong in `src/lib/validations/`

### Reusability

- UI that's used in more than one place → `src/components/`
- Page-specific full-section UI → `src/page-components/`
- Business logic / calculations → `src/lib/utils/`
- If a component exceeds ~300 lines, split it

### TypeScript

- Strict mode is off (`noImplicitAny: false`) but you should still type everything explicitly
- Use `interface` for object shapes, `type` for unions and aliases
- Domain types live in `src/types/` (user, order, wish, etc.)
- DB-derived types live in `src/lib/types/` and `src/lib/database.types.ts`
- Path alias: always use `@/` instead of relative `../../`

### Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Components | PascalCase | `AddProductModal.tsx` |
| Hooks | camelCase with `use` prefix | `usePaginatedReactQuery` |
| Context files | PascalCase + Context suffix | `InventoryContext.tsx` |
| Utility functions | camelCase | `calculatePricePerUnit` |
| Types/interfaces | PascalCase | `InventoryItem`, `UserRole` |
| Constants | SCREAMING_SNAKE_CASE | `TOAST_MESSAGES`, `GRADES` |
| DB columns | snake_case (Supabase) | `device_name`, `selling_price` |
| TS fields | camelCase | `deviceName`, `sellingPrice` |

### File Placement Rules

- `app/` — routing only, thin page files
- `src/page-components/` — full-page React components (imported by `app/` pages)
- `src/components/` — shared components used across multiple pages
- `src/contexts/` — React Context providers
- `src/lib/` — utilities, DB queries, auth, constants
- `src/hooks/` — custom React hooks
- `src/types/` — TypeScript type definitions

### Code Style

- No magic numbers: use named constants
- No hardcoded strings in components: use constants for messages, labels, keys
- Error handling: `try/catch` in async functions, always show a `toast.error()` on failure
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client — it's server-only

---

## 16. Adding a New Feature — Step-by-Step

Use the **Wishes** feature as a reference example (`src/contexts/WishesContext.tsx`, `src/types/wish.ts`, `src/lib/supabase/queries/wishes.ts`, `app/user/wishes/`).

### Step 1: Database Migration

Create `supabase/migrations/040_your_feature.sql`:

```sql
CREATE TABLE public.your_feature (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- your columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.your_feature ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rows" ON public.your_feature
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rows" ON public.your_feature
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

> Share SQL with the team — everyone runs it manually in Supabase SQL Editor.

### Step 2: TypeScript Types

Create `src/types/yourFeature.ts`:

```typescript
export interface YourFeature {
  id: string;
  userId: string;
  // ... your fields
  createdAt: string;
}
```

### Step 3: Query Functions + Mapper

Create `src/lib/supabase/queries/yourFeature.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { YourFeature } from "@/types/yourFeature";

export function mapYourFeatureRow(row: any): YourFeature {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

export async function fetchYourFeatures(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("your_feature")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return data.map(mapYourFeatureRow);
}
```

### Step 4: Query Key

Add to `src/lib/query-keys.ts`:

```typescript
export const queryKeys = {
  // ...existing keys...
  yourFeature: ['your_feature'] as const,
  yourFeaturePage: (userId: string) => [...queryKeys.yourFeature, userId] as const,
};
```

### Step 5: Context (if needed for cross-component state)

Create `src/contexts/YourFeatureContext.tsx`. Follow the pattern of `WishesContext.tsx` or `WishlistContext.tsx`.

Add it to `src/components/Providers.tsx` in the correct dependency order.

### Step 6: UI

- For a new admin page: create `src/page-components/YourFeature.tsx`, then `app/admin/your-feature/page.tsx`
- For a new user page: create `app/user/your-feature/page.tsx`
- For a modal: add to `src/components/YourFeatureModal.tsx`

### Step 7: API Route (if needed)

Create `app/api/your-feature/route.ts` following the pattern from Section 14.

---

## 17. Git Workflow

See `docs/BRANCHING_AND_WORKFLOW.md` for the full guide. Summary:

```
main          — production (b2bmobiles.ca)
development   — staging (stoq-bice.vercel.app)
feature/*     — your work
fix/*         — bug fixes
```

```bash
# Start a new feature
git checkout development
git pull
git checkout -b feature/your-feature-name

# Work, commit often
git add src/components/YourComponent.tsx src/contexts/YourContext.tsx
git commit -m "feat: add your feature"

# Open PR into development (never directly into main)
gh pr create --base development
```

**Never commit:**
- `.env.local` or any file with secrets
- `node_modules/`
- Generated `dist/` or `.next/` builds

---

## 18. Deployment

Vercel auto-deploys:
- Push to `main` → deploys to b2bmobiles.ca
- Push to `development` → deploys to stoq-bice.vercel.app (staging)

### Required Vercel Environment Variables

Set these in Vercel → Project Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=https://b2bmobiles.ca
```

### Pre-Deploy Checklist

- [ ] All new migrations applied to production Supabase (manually, via SQL Editor)
- [ ] No `.env.local` secrets in git
- [ ] `npm run build` passes locally
- [ ] Tested on staging (`development` branch) first
- [ ] RLS policies verified for new tables

See `docs/PRODUCTION_STANDARDS.md` for the full checklist.

---

## 19. Troubleshooting

**Admin login says "Access denied" or redirects to homepage**
→ Check `user_profiles.role = 'admin'` for your user in Supabase Table Editor
→ Run `npm run seed` to recreate the admin user

**RLS infinite recursion error**
→ Migration `003_fix_rls_recursion.sql` must be applied
→ Check `docs/RLS_POLICIES_EXPLAINED.md`

**Inventory not showing for regular users**
→ Check `is_active = true` on the inventory rows
→ Confirm user's `approval_status = 'approved'` in `user_profiles`

**Cart not persisting after page refresh**
→ For guests: localStorage must not be blocked
→ For logged-in users: check `cart_items` table in Supabase

**Migration failing partway through**
→ Do NOT re-run from the beginning — it will drop tables
→ Identify which statement failed, fix it, run only that statement

**Build error: `Module not found: @/...`**
→ Check `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }`
→ The `@/` alias maps to `./src/` — ensure the file path is correct

**Supabase realtime not updating the UI**
→ Check `RealtimeContext.tsx` includes your table in the subscription
→ Ensure realtime is enabled for that table in Supabase Dashboard → Database → Replication

---

## 20. Where to Find Things

| I need to... | Look here |
|-------------|-----------|
| Add a new page | `app/` (route) + `src/page-components/` (component) |
| Add a modal/dialog | `src/components/YourModal.tsx` using `Dialog` from `ui/` |
| Add a DB query | `src/lib/supabase/queries/` |
| Add a new type | `src/types/` (domain) or `src/lib/types/` (DB-derived) |
| Add a form | React Hook Form + Zod in component, schema in `src/lib/validations/` |
| Add a toast message | `src/lib/constants/toast-messages.ts` |
| Add a query key | `src/lib/query-keys.ts` |
| Add a constant | `src/lib/constants/index.ts` |
| Add a utility function | `src/lib/utils/` |
| Add a custom hook | `src/hooks/` |
| Understand RLS policies | `docs/RLS_POLICIES_EXPLAINED.md` |
| Understand auth flow | `docs/AUTH_TROUBLESHOOTING.md` |
| Understand migration process | `docs/MIGRATION_GUIDE.md` |
| Understand API field exposure | `docs/API_DATA_MINIMIZATION.md` |
| Understand git workflow | `docs/BRANCHING_AND_WORKFLOW.md` |
| Set up environments | `docs/ENVIRONMENTS_AND_SUPABASE.md` |
| Pre-production checklist | `docs/PRODUCTION_STANDARDS.md` |
