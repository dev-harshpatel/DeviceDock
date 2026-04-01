-- Add city and user_id to company_registrations.
-- city: collected in the signup form's business details step.
-- user_id: links the registration record to the auth user created during signup,
--           so the auth callback can find and activate the registration.

alter table public.company_registrations
  add column if not exists city    text not null default '',
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
