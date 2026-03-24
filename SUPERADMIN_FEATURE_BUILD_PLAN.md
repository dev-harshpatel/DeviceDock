# Super Admin Feature Build Plan

This document extends the current super admin scope from `Implementation-phases.md` with high-impact features that can be built one-by-one.

When you say **"build 1"**, we will implement **Build 1** end-to-end from this file.

---

## Planning Principles

- Keep current company-facing behavior unchanged.
- Build only in `superadmin` namespace or server-side admin APIs.
- Enforce RBAC at API and layout level for every build.
- Prefer incremental migrations and reversible rollout.
- Ship each build with UI + API + logging + testing together.

---

## Suggested Build Queue (Priority Order)

1. **Build 1 — Super Admin Audit Logs**
2. **Build 2 — Company Impersonation (Secure Read-Only Mode)**
3. **Build 3 — Tenant Health & Usage Analytics**
4. **Build 4 — Billing/Plan Management Controls**
5. **Build 5 — Global Feature Flags by Company**
6. **Build 6 — Risk & Abuse Controls (Rate Limits + Account Actions)**
7. **Build 7 — Data Export / Compliance Toolkit**
8. **Build 8 — Incident Center (Platform Alerts + Runbooks)**

---

## Build 1 — Super Admin Audit Logs

**Status**: ✅ Done

### Goal
Track every critical super admin action with who/what/when/where so platform actions are fully traceable.

### Why first
- Highest security and compliance value.
- Helps debugging and accountability for all future builds.
- Low UX risk, high operational gain.

### Scope
- Log all writes from super admin APIs:
  - create/update/delete company
  - user role/status actions
  - future admin actions via reusable helper
- Super admin UI page to search and filter logs.

### Data Model
- New table: `platform_audit_logs`
  - `id uuid pk`
  - `actor_user_id uuid not null`
  - `actor_email text null`
  - `action text not null` (e.g. `company.update`)
  - `resource_type text not null` (e.g. `company`, `company_user`)
  - `resource_id text not null`
  - `company_id uuid null`
  - `metadata_json jsonb not null default '{}'::jsonb`
  - `ip_address text null`
  - `user_agent text null`
  - `created_at timestamptz not null default now()`

Indexes:
- `(created_at desc)`
- `(actor_user_id, created_at desc)`
- `(resource_type, resource_id, created_at desc)`
- `(company_id, created_at desc)`

### Backend Plan
1. Add migration for `platform_audit_logs`.
2. Create helper: `src/lib/superadmin/audit.ts`
   - `logPlatformAudit({ action, resourceType, resourceId, companyId, metadata })`
3. In all superadmin write APIs:
   - extract actor from auth context
   - call audit helper after success
   - include before/after snapshots for updates (minimal diff)
4. Add API:
   - `GET /api/superadmin/audit-logs`
   - filters: `action`, `actor`, `resourceType`, `companyId`, `from`, `to`, `q`
   - pagination + sort by `created_at desc`

### Frontend Plan
1. Add page: `app/superadmin/audit-logs/page.tsx`
2. Add nav item in super admin sidebar.
3. Build filter bar:
   - action dropdown
   - actor search
   - resource type dropdown
   - date range
4. Build table:
   - timestamp, actor, action, resource, company, metadata summary
5. Add details drawer/modal with full `metadata_json`.

### Security Plan
- Super admin only endpoint.
- Never expose secrets in metadata.
- Redact PII fields if needed (`password`, tokens, keys).

### Test Plan
- Unit: helper writes valid row.
- API: unauthorized blocked, filters work, pagination stable.
- E2E:
  - perform company update
  - verify audit row appears with correct actor/action/resource.

### Definition of Done
- Every superadmin write action logs successfully.
- Search/filter UI works for real data.
- No performance regression on large log table.

---

## Build 2 — Company Impersonation (Secure Read-Only Mode)

### Goal
Allow super admin to enter a company context for debugging without using customer credentials.

### Scope
- Start impersonation session from company detail page.
- Read-only mode first (no write actions).
- Visual "Impersonating X" banner and quick exit.

### Backend Plan
1. Add signed impersonation token endpoint:
   - `POST /api/superadmin/impersonation/start`
2. Store ephemeral session state (short TTL).
3. Middleware validates impersonation token and injects context.

### Frontend Plan
1. "Impersonate (Read-Only)" CTA in company detail.
2. Banner in company pages with `Stop Impersonation`.
3. Disable all mutating CTAs in impersonation mode.

### Security Plan
- hard TTL (15 min)
- full audit log for start/stop
- forbid nested impersonation
- only platform super admin role allowed

### Definition of Done
- Super admin can inspect tenant views safely.
- No writes possible during impersonation.

---

## Build 3 — Tenant Health & Usage Analytics

**Status**: ✅ Done

### Goal
Give super admin a real-time operational snapshot of each company.

### Metrics
- active users (7d/30d)
- inventory records count
- orders count + trend
- last activity timestamp
- error rates (if available)

### Plan
- materialized/aggregated query layer
- company health score + status badge
- superadmin dashboard widgets + company detail charts

### Definition of Done
- Dashboard and company detail expose actionable health signals.

---

## Build 4 — Billing/Plan Management Controls

### Goal
Manage company plan lifecycle from super admin.

### Scope
- plan assignment (`trial`, `basic`, `pro`, `enterprise`)
- billing status (`active`, `past_due`, `suspended`)
- trial start/end
- suspension reason + restore

### Plan
- extend companies billing columns or dedicated table
- policy checks in middleware/guards for suspended tenants
- super admin controls + change history in audit logs

### Definition of Done
- Super admin can manage plan + status safely with full traceability.

---

## Build 5 — Global Feature Flags by Company

### Goal
Roll out features gradually and safely per tenant.

### Scope
- feature flag registry
- per-company override
- kill switch support
- UI for toggles + notes

### Plan
- table: `platform_feature_flags`, `company_feature_flags`
- server utility `isFeatureEnabled(companyId, flagKey)`
- integrate with existing guarded UI sections

### Definition of Done
- Feature rollout can be controlled without deploy.

---

## Build 6 — Risk & Abuse Controls

### Goal
Give super admin tools to protect platform from abusive usage.

### Scope
- login anomaly counters
- company/user lock actions
- global throttling toggles for risky endpoints

### Plan
- risk events table
- super admin risk dashboard
- lock/unlock actions (audited)

### Definition of Done
- suspicious activity can be detected and acted on quickly.

---

## Build 7 — Data Export / Compliance Toolkit

### Goal
Support admin-grade exports and compliance workflows.

### Scope
- company-scoped export requests
- async job tracking
- downloadable CSV/JSON bundles
- optional deletion request workflow (soft-delete pipeline)

### Definition of Done
- super admin can generate traceable exports reliably.

---

## Build 8 — Incident Center

### Goal
Operational console for platform incidents.

### Scope
- incident timeline entries
- impacted companies list
- runbook checklist
- comms notes

### Definition of Done
- incident response is centralized and documented.

---

## Execution Template (Use for Any Build)

For each `build N`, execute in this order:

1. **Discovery**
   - confirm affected modules, existing APIs, and schema dependencies.
2. **Schema**
   - create migration and types updates.
3. **Server/API**
   - add routes, auth checks, service/helper layer.
4. **UI**
   - add pages/components and wire data fetching.
5. **Observability**
   - logs, toasts, error boundaries, audit integration.
6. **Testing**
   - unit + integration + manual end-to-end checklist.
7. **Documentation**
   - update this file and release notes with final behavior.

---

## Recommended Next Action

Continue with **Build 4 — Billing/Plan Management Controls** or **Build 5 — Global Feature Flags by Company**.

Builds 1 and 3 are complete, so you can now focus on monetization controls or safe progressive rollout.
