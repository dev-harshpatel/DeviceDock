-- Cherry-picked from legacy 021 + 022 + 025 with safety guards.

do $$
begin
  if to_regclass('public.inventory') is null then
    raise notice 'Skipping 014_add_inventory_pricing_and_flags: public.inventory table does not exist.';
    return;
  end if;

  alter table public.inventory
    add column if not exists purchase_price numeric(10,2),
    add column if not exists hst numeric(10,2),
    add column if not exists selling_price numeric(10,2),
    add column if not exists is_active boolean not null default true;

  update public.inventory
  set selling_price = price_per_unit
  where selling_price is null;

  update public.inventory
  set is_active = true
  where is_active is null;
end $$;
