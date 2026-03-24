# Cursor Skill: Tenancy + RBAC Guard

## Use for
- tenant-scoped features
- admin permissions
- sensitive mutations

## Mandatory Docs
- `docs/SAAS_TENANCY_MODEL.md`
- `docs/RBAC_AUTHORIZATION.md`

## Steps
1. Identify tenant-owned entities.
2. Apply `company_id` scope to reads and aggregates.
3. Enforce role + membership on mutations.
4. Ensure unauthorized UI actions are hidden/disabled.
5. Ensure unauthorized API actions are blocked.
6. List cross-tenant negative test cases.

## Required Output
- isolation points updated
- role checks added
- denial behavior defined
- test cases listed

