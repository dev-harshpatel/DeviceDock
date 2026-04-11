-- Cherry-picked from legacy 010.

create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  state_province text not null,
  city text,
  tax_rate decimal(5, 2) not null,
  tax_type text not null check (tax_type in ('GST', 'HST', 'Sales Tax')),
  effective_date date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tax_rates_country on public.tax_rates(country);
create index if not exists idx_tax_rates_state_province on public.tax_rates(state_province);
create index if not exists idx_tax_rates_city on public.tax_rates(city);
create index if not exists idx_tax_rates_country_state on public.tax_rates(country, state_province);
create index if not exists idx_tax_rates_country_state_city on public.tax_rates(country, state_province, city);

create unique index if not exists idx_tax_rates_unique_state
on public.tax_rates(country, state_province)
where city is null;

create unique index if not exists idx_tax_rates_unique_city
on public.tax_rates(country, state_province, city)
where city is not null;

create or replace function public.update_tax_rates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_tax_rates_updated_at on public.tax_rates;
create trigger update_tax_rates_updated_at
before update on public.tax_rates
for each row execute function public.update_tax_rates_updated_at();
