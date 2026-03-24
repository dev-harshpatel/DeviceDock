# b2bmobiles — Inventory & Order Management

Stoq is a **Next.js (App Router)** inventory + order management app backed by **Supabase**.  
It includes a public browsing experience, a user area, and a protected admin panel for managing inventory and orders.

## Features

- **Inventory browsing** (public) — browse products by grade, brand, model
- **Cart + checkout flow** — add to cart, checkout with shipping/billing addresses
- **Orders**
  - Users can create/view their own orders
  - Admins can view/update all orders, create manual sales, generate invoices
- **User approval flow** — admins approve/reject user profiles; users see approval status
- **Wishlist** — users can save items to a wishlist
- **Stock requests** — users can request out-of-stock items
- **Reports & analytics** — dashboard, demand forecasting, HST reconciliation
- **Product uploads** — bulk upload inventory via Excel
- **Role-based access**
  - Admin routes under `/admin/*` are protected
  - Role is stored in `public.user_profiles.role` (`user` / `admin`)
- **Supabase RLS** (Row Level Security) for `user_profiles`, `inventory`, `orders`, and related tables
- **Modern UI** using Tailwind + shadcn/ui + Radix primitives

## Tech stack

- **Next.js 14** (App Router), **React 18**, **TypeScript**
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`)
- **Tailwind CSS** + **shadcn/ui**
- **Lucide** icons, **Sonner** toasts
- **Recharts** (charts), **jsPDF** (invoices), **xlsx** (Excel import/export)

## Routes

- **Public**
  - `/` — home
  - `/user` — user products page
  - `/user/grades` — browse by grade
  - `/user/orders` — user's orders (requires auth)
  - `/user/stats` — user stats (requires auth)
  - `/user/wishlist` — wishlist (requires auth)
  - `/user/profile` — profile (requires auth)
  - `/contact` — contact page
  - `/auth/reset-password` — password reset
  - `/auth/auth-code-error` — auth error handling
- **Admin**
  - `/admin/login` — admin login (public)
  - `/admin/*` — protected admin area (requires auth + admin role)
  - `/admin/dashboard` — dashboard
  - `/admin/inventory` — inventory management
  - `/admin/products` — product catalog
  - `/admin/orders` — order management
  - `/admin/orders/[orderId]/invoice` — invoice view/print
  - `/admin/users` — user management
  - `/admin/demand` — demand forecasting
  - `/admin/reports` — reports & analytics
  - `/admin/hst` — HST reconciliation
  - `/admin/alerts` — low-stock alerts
  - `/admin/settings` — company settings
  - `/admin/upload-products` — bulk product upload

Route protection is implemented via:

- **Middleware**: `src/lib/supabase/middleware.ts`
- **Client guard**: `src/lib/auth/AuthGuard.tsx` (wired in `app/admin/layout.tsx`)

More details: [docs/PROTECTED_ROUTES.md](./docs/PROTECTED_ROUTES.md)

## Getting started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Copy the example env file:

```bash
# macOS / Linux
cp .env.example .env.local

# Windows (cmd)
copy .env.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional (for running migrations from CLI):

```env
DATABASE_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
```

Get `DATABASE_URL` from **Supabase Dashboard → Settings → Database → Connection string (URI)**.

> **Note:** Never commit `.env.local`. Use your hosting provider's env settings for production.

### 3) Run migrations

**Option A — With DATABASE_URL set** (recommended):

```bash
npm run migrate
```

This runs all pending migrations in order via a direct Postgres connection.

**Option B — Without DATABASE_URL** (manual):

1. Run `npm run migrate` — it will list pending migrations and print instructions.
2. Or run `npm run migrate:show` to see migration SQL.
3. In **Supabase Dashboard → SQL Editor**, run each migration file in `supabase/migrations/` in order (001, 002, 003, … through 038).

There are 39 migration files. Run them in numeric order by filename.

More details: [docs/MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md)

### 4) Seed the database

```bash
npm run seed
```

This creates sample users, inventory, and orders, including:

- **Admin**: `admin@stoq.com` / `admin123`
- **Users**: `user1@example.com` / `user123`, `user2@example.com` / `user123`

### 5) Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful scripts

```bash
npm run dev           # start local dev server
npm run build         # production build
npm run start         # start production server
npm run lint          # run eslint
npm run migrate       # run/verify migrations (requires DATABASE_URL for auto-run)
npm run migrate:show  # print migration SQL
npm run migrate:record # record migrations as executed (advanced)
npm run seed          # create demo users + data
npm run reset-inventory # reset inventory (dev helper)
```

## Data model (high-level)

- **`auth.users`** (Supabase Auth): stores user accounts (email/password hash, etc.)
- **`public.user_profiles`**: app profile + role + approval status + business fields + cart snapshot + wishlist
- **`public.inventory`**: inventory items (grades, brands, models, prices)
- **`public.orders`**: user orders (JSONB items + totals + status + manual sales)
- **`public.tax_rates`**: HST/tax configuration
- **`public.product_uploads`**: bulk upload metadata

> If you don't "see users" in the Table Editor, check **Supabase Dashboard → Authentication → Users**.  
> The Table Editor defaults to the `public` schema.

## Documentation

- [Protected routes](./docs/PROTECTED_ROUTES.md) — route protection details
- [Migration guide](./docs/MIGRATION_GUIDE.md) — database setup
- [Security review](./docs/SECURITY_REVIEW.md) — security checklist
- [API data minimization](./docs/API_DATA_MINIMIZATION.md) — admin vs public field exposure
- [RLS policies](./docs/RLS_POLICIES_EXPLAINED.md) — Row Level Security
- [Fix recursion](./docs/FIX_RECURSION.md) — RLS recursion troubleshooting

## Troubleshooting

### Admin login shows "Access denied"

This happens when `public.user_profiles.role` for your admin user is not `admin`.

- Run:

```bash
npm run seed
```

The seed script ensures the admin profile exists and sets the role to `admin`.

### RLS recursion / policy issues

If you see errors related to infinite recursion or RLS policy checks, ensure you applied:

- `supabase/migrations/003_fix_rls_recursion.sql`

See: [docs/FIX_RECURSION.md](./docs/FIX_RECURSION.md)

## Deployment

This repo includes a `vercel.json` with:

```json
{ "framework": "nextjs" }
```

Deploy on Vercel (or similar) and configure the same environment variables in your hosting provider.

### Production standards (b2bmobiles.ca)

For a safe, repeatable workflow now that the app is live:

- **[Production standards](./docs/PRODUCTION_STANDARDS.md)** — Overview, pre-deploy checklist, and what to do if something goes wrong.
- **[Branching & workflow](./docs/BRANCHING_AND_WORKFLOW.md)** — Use `main` for production, `dev` for integration, and feature branches that merge into `dev` first.
- **[Environments & Supabase](./docs/ENVIRONMENTS_AND_SUPABASE.md)** — Separate Supabase projects for dev and production; how to manage env vars locally and in Vercel.
- **[Option B: Two projects setup](./docs/OPTION_B_TWO_PROJECTS_SETUP.md)** — Step-by-step for two Supabase projects, replicating prod → dev, clearing prod, Vercel envs, and domains (b2bmobiles.ca = production, stoq-bice.vercel.app = dev/preview).

## Project structure (quick)

- `app/` — Next.js App Router routes
- `src/components/` — shared UI components
- `src/page-components/` — page-level components
- `src/contexts/` — app state contexts (auth, profile, inventory, orders, cart)
- `src/lib/supabase/` — Supabase client/server helpers + middleware
- `src/lib/auth/` — AuthGuard and auth utilities
- `supabase/` — migrations + scripts (seed, migrate)
