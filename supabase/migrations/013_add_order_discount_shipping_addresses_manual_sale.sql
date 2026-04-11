-- Cherry-picked from legacy 014 + 017 + 019 + 026 + 029 with safety guards.

do $$
begin
  if to_regclass('public.orders') is null then
    raise notice 'Skipping 013_add_order_discount_shipping_addresses_manual_sale: public.orders table does not exist.';
    return;
  end if;

  alter table public.orders
    add column if not exists discount_amount decimal(10, 2) default 0.00,
    add column if not exists discount_type varchar(20) default 'cad',
    add column if not exists shipping_amount decimal(10, 2) default 0.00,
    add column if not exists shipping_address text,
    add column if not exists billing_address text,
    add column if not exists imei_numbers jsonb default '{}'::jsonb,
    add column if not exists is_manual_sale boolean default false,
    add column if not exists manual_customer_name text,
    add column if not exists manual_customer_email text,
    add column if not exists manual_customer_phone text;
end $$;
