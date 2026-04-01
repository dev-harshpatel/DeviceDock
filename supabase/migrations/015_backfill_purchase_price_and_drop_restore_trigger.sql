-- Cherry-picked from legacy 038 + 044 with safety guards.

do $$
begin
  if to_regclass('public.orders') is not null then
    drop trigger if exists restore_inventory_after_order_delete on public.orders;
  end if;
end $$;

do $$
begin
  if to_regclass('public.inventory') is null then
    raise notice 'Skipping purchase_price backfill: public.inventory table does not exist.';
    return;
  end if;

  update public.inventory
  set
    purchase_price = 0,
    updated_at = now()
  where quantity = 0
    and purchase_price is not null
    and purchase_price <> 0;

  update public.inventory
  set
    purchase_price = round(
      (price_per_unit / nullif(1.0 + coalesce(hst, 0) / 100.0, 0)) * quantity,
      2
    ),
    updated_at = now()
  where quantity > 0
    and purchase_price is not null
    and price_per_unit is not null
    and price_per_unit > 0
    and hst is not null;
end $$;
