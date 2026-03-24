-- Cherry-picked from legacy 013 with safety guards.

do $$
begin
  if to_regclass('public.orders') is null then
    raise notice 'Skipping 012_add_order_invoice_fields: public.orders table does not exist.';
    return;
  end if;

  alter table public.orders
    add column if not exists invoice_number text,
    add column if not exists invoice_date date,
    add column if not exists po_number text,
    add column if not exists payment_terms text,
    add column if not exists due_date date,
    add column if not exists hst_number text,
    add column if not exists invoice_notes text,
    add column if not exists invoice_terms text,
    add column if not exists invoice_confirmed boolean default false,
    add column if not exists invoice_confirmed_at timestamptz;

  create index if not exists idx_orders_invoice_number on public.orders(invoice_number);
  create index if not exists idx_orders_invoice_confirmed on public.orders(invoice_confirmed);
end $$;
