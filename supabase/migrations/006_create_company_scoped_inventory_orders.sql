-- SaaS bridge migration:
-- Create company-scoped inventory and orders tables if they do not exist.
-- This is intentionally additive and aligned with example-migration tenancy baseline.

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  device_name text not null,
  brand text not null,
  grade text not null check (grade in ('A', 'B', 'C')),
  storage text not null,
  quantity integer not null default 0,
  price_per_unit numeric(10, 2) not null,
  last_updated text not null,
  price_change text check (price_change in ('up', 'down', 'stable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  total_price numeric(10, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_company_id on public.inventory(company_id);
create index if not exists idx_inventory_brand on public.inventory(brand);
create index if not exists idx_inventory_grade on public.inventory(grade);

create index if not exists idx_orders_company_id on public.orders(company_id);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at
before update on public.inventory
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();
