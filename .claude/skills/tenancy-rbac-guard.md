# Skill: Tenancy + RBAC Guard

## Trigger
Use when request touches:
- tenant/company data
- admin permissions
- API mutations on protected resources

## Mandatory References
- `docs/SAAS_TENANCY_MODEL.md`
- `docs/RBAC_AUTHORIZATION.md`
- `docs/ADMIN_REBUILD_PHASE_PLAN.md`

## Workflow
1. Identify tenant-owned entities in change scope.
2. Enforce `company_id` filtering on all reads/aggregates.
3. Enforce role + membership checks on all mutations.
4. Validate UI hides/disables unauthorized actions.
5. Validate server rejects unauthorized actions (403).
6. Confirm no cross-tenant leakage path exists.

## Hard Rules
- Frontend checks are never enough; server checks required.
- Never trust client-provided company ID without validation.
- Audit-sensitive actions must include actor + role + company context.

## Output Checklist
- company scope points updated
- role checks added/verified
- denied behavior defined
- cross-tenant test cases listed

