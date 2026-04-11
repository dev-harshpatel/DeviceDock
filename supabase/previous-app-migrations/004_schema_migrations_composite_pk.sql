-- Allow multiple migrations per version number (e.g. 005_add_user_details and 005_diagnose_and_fix_rls)
-- by changing primary key from (version) to (version, name).
-- Run this before duplicate version numbers so recording works.

ALTER TABLE public.schema_migrations DROP CONSTRAINT IF EXISTS schema_migrations_pkey;
ALTER TABLE public.schema_migrations ADD PRIMARY KEY (version, name);
