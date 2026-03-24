insert into public.feature_catalog (key, label)
values
  ('company_dashboard', 'Company dashboard')
on conflict (key) do nothing;

insert into public.feature_catalog (key, label)
values
  ('manage_users', 'Manage company users')
on conflict (key) do nothing;

insert into public.feature_catalog (key, label)
values
  ('manage_feature_permissions', 'Manage feature permissions')
on conflict (key) do nothing;

-- Role defaults: owner gets all by default, others are denied except dashboard.
insert into public.role_feature_defaults (role, feature_id, allowed)
select r.role, f.id, r.allowed
from
  (values
    ('owner'::text, 'company_dashboard'::text, true::boolean),
    ('owner'::text, 'manage_users'::text, true::boolean),
    ('owner'::text, 'manage_feature_permissions'::text, true::boolean),
    ('manager'::text, 'company_dashboard'::text, true::boolean),
    ('manager'::text, 'manage_users'::text, false::boolean),
    ('manager'::text, 'manage_feature_permissions'::text, false::boolean),
    ('inventory_admin'::text, 'company_dashboard'::text, true::boolean),
    ('inventory_admin'::text, 'manage_users'::text, false::boolean),
    ('inventory_admin'::text, 'manage_feature_permissions'::text, false::boolean),
    ('analyst'::text, 'company_dashboard'::text, true::boolean),
    ('analyst'::text, 'manage_users'::text, false::boolean),
    ('analyst'::text, 'manage_feature_permissions'::text, false::boolean)
  ) as r(role, feature_key, allowed)
join public.feature_catalog f on f.key = r.feature_key
on conflict (role, feature_id) do update set
  allowed = excluded.allowed;

