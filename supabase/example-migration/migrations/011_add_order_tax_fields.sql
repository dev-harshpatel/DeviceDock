-- Cherry-picked from legacy 012 with safety guards.

do $$
begin
  if to_regclass('public.orders') is null then
    raise notice 'Skipping 011_add_order_tax_fields: public.orders table does not exist.';
    return;
  end if;

  alter table public.orders
    add column if not exists subtotal decimal(10, 2),
    add column if not exists tax_rate decimal(5, 2),
    add column if not exists tax_amount decimal(10, 2);

  update public.orders
  set subtotal = total_price,
      tax_rate = 0.00,
      tax_amount = 0.00
  where subtotal is null;
end $$;
