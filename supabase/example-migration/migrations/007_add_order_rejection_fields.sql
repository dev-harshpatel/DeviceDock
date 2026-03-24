-- Cherry-picked from legacy 007 with safety guards.

do $$
begin
  if to_regclass('public.orders') is null then
    raise notice 'Skipping 007_add_order_rejection_fields: public.orders table does not exist.';
    return;
  end if;

  alter table public.orders
    add column if not exists rejection_reason text,
    add column if not exists rejection_comment text;

  comment on column public.orders.rejection_reason is 'Common rejection reason selected by admin';
  comment on column public.orders.rejection_comment is 'Optional additional comment when rejecting an order';
end $$;
