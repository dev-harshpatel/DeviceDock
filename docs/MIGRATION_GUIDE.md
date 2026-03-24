# Database Migration & Setup Guide

## Overview

This project now uses Supabase directly for all database operations. The schema has been redesigned with proper user profiles, roles, and relationships.

## Database Schema

### Tables

1. **user_profiles**
   - Links to Supabase `auth.users` via `user_id`
   - Stores user role: `'user'` or `'admin'`
   - Automatically created when a user signs up

2. **inventory**
   - Product inventory items
   - Public read access (for browsing)
   - Admin write access only

3. **orders**
   - User orders with JSONB items
   - Linked to `auth.users` via `user_id`
   - Users can create/view their own orders
   - Admins can view/update all orders

## Setup Instructions

### 1. Run Migrations

Migrations must be run manually via Supabase Dashboard:

1. Go to Supabase Dashboard → SQL Editor
2. Run migrations in order:
   - Copy and paste contents of `supabase/migrations/001_initial_schema.sql`
   - Execute the SQL
   - Copy and paste contents of `supabase/migrations/002_rls_policies.sql`
   - Execute the SQL
   - Copy and paste contents of `supabase/migrations/003_fix_rls_recursion.sql`
   - Execute the SQL (This fixes the infinite recursion issue)
   - Copy and paste contents of `supabase/migrations/004_verify_and_fix_orders.sql`
   - Execute the SQL (This ensures admins can see and update all orders)

Alternatively, check pending migrations:
```bash
npm run migrate
```

To see migration SQL:
```bash
npm run migrate:show
```

### 2. Seed Database

After migrations, seed the database with sample data:

```bash
npm run seed
```

This will create:
- Admin user: `admin@stoq.com` / `admin123`
- Sample users: `user1@example.com` / `user123`, `user2@example.com` / `user123`
- Inventory items from `src/data/inventory.ts`
- Sample orders

### 3. Environment Variables

Ensure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For migrations and seeding
```

## User Roles

### Admin
- Can view/update all orders
- Can manage inventory
- Can view all user profiles
- Access to `/admin/*` routes

### User
- Can browse inventory (no login required)
- Can create orders (login required)
- Can view own orders
- Access to `/user` routes

## Authentication Flow

1. **Browsing**: Users can browse inventory without login
2. **Checkout**: When user tries to checkout:
   - If not logged in → Login modal appears
   - After login → Checkout proceeds automatically
3. **Order Management**: 
   - Users see their own orders
   - Admins see all orders and can approve/reject

## Future Migrations

When you need to change the schema:

1. Create new SQL file: `supabase/migrations/003_your_migration_name.sql`
2. Run it in Supabase Dashboard → SQL Editor
3. Update `src/lib/database.types.ts` to match new schema
4. Update TypeScript code as needed
5. (Optional) Record migration: `npm run migrate:record 003 your_migration_name`

## Code Structure

### Contexts
- `UserProfileContext`: Manages user profile and role state
- `OrdersContext`: Manages orders (no username field)
- `InventoryContext`: Manages inventory
- `CartContext`: Manages shopping cart
- `AuthContext`: Manages authentication

### Utilities
- `src/lib/supabase/utils.ts`: User profile helpers (`getUserProfile`, `isAdmin`, etc.)
- `src/lib/supabase/client.ts`: Supabase client for browser
- `src/lib/supabase/server.ts`: Supabase client for server

### Types
- `src/types/user.ts`: User profile types
- `src/types/order.ts`: Order types (no username)
- `src/lib/database.types.ts`: Supabase database types

## Key Changes from Previous Version

1. **Removed Prisma**: All database operations use Supabase directly
2. **User Profiles**: Added `user_profiles` table with roles
3. **Orders**: Removed `username` field (get from user profile)
4. **UUIDs**: All IDs now use UUID instead of text
5. **RLS Policies**: Proper Row Level Security for all tables
6. **Type Safety**: Removed all `any` types, proper error handling

## Troubleshooting

### Migration Issues
- Ensure you're running migrations in order (001, 002, etc.)
- Check Supabase Dashboard → Table Editor to verify tables exist
- Verify RLS policies in Supabase Dashboard → Authentication → Policies

### Authentication Issues
- Check that `user_profiles` are created on signup (handled automatically)
- Verify RLS policies allow authenticated users to insert their own profile

### Order Creation Issues
- Ensure user is logged in before checkout
- Check that `orders` table exists and has correct schema
- Verify RLS policies allow users to insert their own orders

## Next Steps

1. Run migrations in Supabase Dashboard
2. Run seed script: `npm run seed`
3. Test the flow:
   - Browse inventory (no login)
   - Add items to cart
   - Checkout (should prompt login)
   - Login and complete checkout
   - Admin can view/approve orders
