-- Extend company_registrations with owner personal details and richer company info.
-- These fields are collected in the multi-step signup form.

alter table public.company_registrations
  add column if not exists owner_first_name  text not null default '',
  add column if not exists owner_last_name   text not null default '',
  add column if not exists owner_phone_code  text not null default '',
  add column if not exists owner_phone       text not null default '',
  add column if not exists years_in_business integer,
  add column if not exists company_website   text,
  add column if not exists company_email     text,
  add column if not exists company_address   text,
  add column if not exists country           text not null default '',
  add column if not exists province          text not null default '';
