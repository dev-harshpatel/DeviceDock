-- Parallel to supabase/migrations/046_storage_company_logos_company_rls.sql
-- Replace legacy admin-only Storage policies on `company-logos` with
-- company-scoped rules that match `company_users` (owner/manager) and the
-- object path prefix `<company_id>/...`.

drop policy if exists "Anyone can view company logos" on storage.objects;
drop policy if exists "Admins can upload company logos" on storage.objects;
drop policy if exists "Admins can update company logos" on storage.objects;
drop policy if exists "Admins can delete company logos" on storage.objects;
drop policy if exists "public_read_company_logos" on storage.objects;
drop policy if exists "company_owners_insert_company_logos" on storage.objects;
drop policy if exists "company_owners_update_company_logos" on storage.objects;
drop policy if exists "company_owners_delete_company_logos" on storage.objects;

create policy "public_read_company_logos"
on storage.objects
for select
using (bucket_id = 'company-logos');

create policy "company_owners_insert_company_logos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-logos'
  and split_part(name, '/', 1) <> ''
  and exists (
    select 1
    from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = split_part(name, '/', 1)::uuid
      and cu.role in ('owner', 'manager')
      and cu.status = 'active'
  )
);

create policy "company_owners_update_company_logos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-logos'
  and split_part(name, '/', 1) <> ''
  and exists (
    select 1
    from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = split_part(name, '/', 1)::uuid
      and cu.role in ('owner', 'manager')
      and cu.status = 'active'
  )
)
with check (
  bucket_id = 'company-logos'
  and split_part(name, '/', 1) <> ''
  and exists (
    select 1
    from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = split_part(name, '/', 1)::uuid
      and cu.role in ('owner', 'manager')
      and cu.status = 'active'
  )
);

create policy "company_owners_delete_company_logos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-logos'
  and split_part(name, '/', 1) <> ''
  and exists (
    select 1
    from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = split_part(name, '/', 1)::uuid
      and cu.role in ('owner', 'manager')
      and cu.status = 'active'
  )
);
