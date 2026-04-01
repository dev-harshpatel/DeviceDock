-- Enforce tenant isolation on the companies table.
--
-- The companies table was created without RLS in migration 001.
-- Without these policies any authenticated user could SELECT every
-- company row, violating tenant isolation.
--
-- Rule: a user may only read a company row if they hold an *active*
-- membership (company_users) for that company.
-- All writes to companies go through the service role only.

alter table public.companies enable row level security;

-- ── SELECT ───────────────────────────────────────────────────────────────────
-- A user can see a company only when they have an active membership in it.
create policy "companies_select_own_tenant"
on public.companies
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = companies.id
      and cu.user_id    = auth.uid()
      and cu.status     = 'active'
  )
);

-- ── INSERT / UPDATE / DELETE ──────────────────────────────────────────────────
-- Company lifecycle management (create, update, deactivate) is performed
-- exclusively through server-side routes using the service role key.
-- Direct client mutations are denied unconditionally.

create policy "companies_no_public_insert"
on public.companies
for insert
to authenticated
with check (false);

create policy "companies_no_public_update"
on public.companies
for update
to authenticated
using (false);

create policy "companies_no_public_delete"
on public.companies
for delete
to authenticated
using (false);
