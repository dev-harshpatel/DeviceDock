# IMEI Inventory Implementation Phases

Use this file as the execution contract.  
Next time, you can tell me exactly: `Implement PLAN-1`, `Implement PLAN-2`, etc., and I will complete that phase end-to-end, then pause for your approval.

This plan extends `docs/INVENTORY_ADD_AND_SALE_FLOW_PLAN.md` and includes sheet-upload mandatory identifier requirements.

---

## Execution Protocol (Mandatory for every phase)

- Preserve existing behavior outside requested phase scope.
- Reuse existing UI patterns/components (shadcn + Tailwind + current design tokens).
- Keep imports sorted alphabetically.
- Use strict TypeScript typing; no `any`/`unknown` unless truly unavoidable.
- Apply additive-only SQL migrations in `supabase/migrations/`.
- Enforce tenant isolation + RBAC on all privileged reads/writes.
- Run lint/type checks for touched files before phase completion.
- Deliver phase with:
  - implemented code
  - migration(s) if needed
  - validation and test notes
  - clear verification steps

---

## Skill Usage Matrix (what to use, when to use)

This section maps available skills and exactly how they are used in this implementation effort.

### Core skills for this project

- `supabase-postgres-best-practices`  
  Use for all schema/index/query changes (identifier uniqueness, bulk import performance, sale updates, RLS-safe data access).

### Repository standards to follow during all phases

- `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/SAAS_TENANCY_MODEL.md`, `docs/RBAC_AUTHORIZATION.md`  
  Use as mandatory implementation standards for structure, UI consistency, tenancy, and authorization.

### Skills currently not required for this specific IMEI flow

- `find-skills` (only for discovering/installing new skills)
- `daybrief-*` skills (project/domain mismatch)
- `imagegen` (no image generation needed)
- `openai-docs` (not an OpenAI API task)
- `plugin-creator`, `skill-creator`, `skill-installer` (no plugin/skill authoring needed)
- `canvas` (not required for this implementation workflow)
- `create-rule` (no new cursor rules requested)
- `update-cursor-settings` (no editor settings task requested)

If scope expands and one of the currently not-required skills becomes relevant, it can be activated in that phase.

---

## Phase Overview

- `PLAN-0`: Discovery + contract freeze
- `PLAN-1`: Database foundations for identifiers and statuses
- `PLAN-2`: Add Product mode selector + Single Product flow
- `PLAN-3`: Bulk Product scan flow
- `PLAN-4`: Sheet upload hardening (mandatory IMEI/Serial columns, same UX flow)
- `PLAN-5`: Sale recording by scan/search
- `PLAN-6`: Security/RBAC/tenancy hardening + audit reliability
- `PLAN-7`: QA, regression, rollout, and production guardrails

Each phase below includes scope, deliverables, acceptance criteria, and test checklist.

---

## PLAN-0 — Discovery and Contract Freeze

## Goal

Freeze implementation assumptions so all later phases execute in one shot without ambiguity.

## Scope

- Confirm current table names and mapping conventions.
- Confirm identifier policy:
  - both `imei` and `serial_number` mandatory per row OR
  - conditional by device type.
- Confirm bulk partial-success behavior.
- Confirm sale reversal rule and required sale reference fields.
- Confirm existing sheet upload endpoint and parser flow.

## Deliverables

- Updated requirement notes in `docs/INVENTORY_ADD_AND_SALE_FLOW_PLAN.md` open-questions resolved.
- Finalized acceptance matrix for all flows.

## Done When

- No open business-rule questions remain.
- Every later phase has deterministic rules.

---

## PLAN-1 — Database Foundations (Identifiers, Status, Audit)

## Goal

Prepare safe, additive schema to support single add, bulk add, sheet upload validation, and sale recording.

## Scope

- Add missing identifier columns and constraints.
- Add/confirm status lifecycle fields.
- Add/confirm sales linkage table.
- Add/confirm activity log coverage.
- Add required indexes for lookup and duplicate detection.

## Database Tasks

- Create migration: `supabase/migrations/<next>_imei_inventory_foundation.sql`
- Add/confirm on inventory table:
  - `imei`
  - `serial_number`
  - `status`
  - `sold_at`
- Add/confirm uniqueness constraints:
  - partial unique index for non-null `imei`
  - partial unique index for non-null `serial_number`
- Add/confirm check constraint for identifier presence per business rule.
- Add/confirm sales table linkage to inventory item.
- Add/confirm activity log fields for actor + status transition.

## Supabase/Postgres best-practice checks

- Avoid full-table locks where possible.
- Use additive migrations only.
- Use indexes that match query patterns (identifier exact lookup, status filters).
- Keep migration idempotent-safe guards where practical.

## Deliverables

- One additive migration with comments and guarded statements.
- Validation query notes in doc comments (optional).

## Done When

- Schema supports identifier uniqueness and sale linkage.
- Existing flows do not break with new nullable/additive columns.

---

## PLAN-2 — Add Product Mode Selector + Single Product Flow

## Goal

Introduce mode selection and complete single-product add with overview confirmation.

## Scope

- Add mode selector at `Add Product` action.
- Build/update single form:
  - scanner/manual identifier capture
  - existing product detail fields
- Add review/overview step before final insert.
- Insert inventory item + activity log on confirmation.

## UI/Design Rules

- Reuse existing dialog/sheet/form/table patterns.
- Keep current visual style and spacing tokens.
- Preserve existing navigation and toasts.

## Validation

- Identifier format + required checks.
- Duplicate check before submit.
- Pricing and required-field validation.

## Deliverables

- Updated UI components and handlers.
- Server/client mutation path for single insert.

## Done When

- Admin can complete single add from scan to confirm.
- Review screen always appears before final insert.

---

## PLAN-3 — Bulk Product Scan Flow

## Goal

Support high-speed batch scanning for same-config devices with row-level validation and summary.

## Scope

- Shared config entry once (model/grade/price/etc.).
- Rapid scan append list for IMEI/Serial rows.
- Row states: valid/invalid with reason.
- Bulk review screen with totals.
- Commit valid rows in one operation.
- Persist activity logs for inserted rows.

## Backend/API

- Validate endpoint for row-level checks.
- Commit endpoint for insert + summary response.
- Duplicate checks:
  - in-session
  - database-level

## Deliverables

- Bulk UI components and state model.
- API contract for validate/commit.

## Done When

- 30+ scan scenario is smooth and deterministic.
- Admin sees exact inserted vs rejected counts with reasons.

---

## PLAN-4 — Sheet Upload Hardening (Same Flow, Mandatory Identifiers)

## Goal

Keep existing sheet-upload UX flow unchanged while enforcing complete identifier data.

## Scope

- Keep existing upload entry, parser route, and interaction flow.
- Make `IMEI` and `Serial Number` header columns mandatory in upload contract.
- Enforce row-level identifier completeness as per finalized business rule.
- Ensure no silent drops of identifier data.
- Return explicit rejected-row report.

## Parser/Validation Rules

- Reject file if required headers are missing.
- Trim whitespace/control chars before validation.
- Reject invalid formats.
- Reject duplicates within file.
- Reject duplicates against DB.
- Produce row-level error object:
  - row number
  - field
  - code
  - message

## Template/UX Updates

- Update downloadable sample template with mandatory columns.
- Update helper text near uploader:
  - required headers
  - identifier format expectation
  - duplicate behavior

## Deliverables

- Updated parser validation.
- Updated template + upload helper text.
- Same upload UX flow retained.

## Done When

- Upload flow looks and behaves the same for user journey.
- Missing IMEI/Serial data cannot pass import.

---

## PLAN-5 — Sale Recording by Scan/Search

## Goal

Allow admin to scan/type identifier, find item quickly, and mark as sold with robust guardrails.

## Scope

- Identifier search input and exact-match lookup.
- Device details + status visibility.
- Sell action for sellable statuses only.
- Sale form capture and confirmation.
- Atomic status update + sale row + activity log.

## Validation

- Prevent double-selling.
- Enforce required sale fields based on finalized policy.
- Preserve audit data (`performed_by`, timestamps).

## Deliverables

- Search and sell UI integration.
- Sell mutation endpoint/service.

## Done When

- Scan -> find -> sell path works in one pass.
- Status and reporting data update reliably.

---

## PLAN-6 — Security, RBAC, Tenancy, and Reliability Hardening

## Goal

Guarantee no cross-tenant leakage and only authorized roles can mutate inventory/sales.

## Scope

- Verify tenant scoping on:
  - single add
  - bulk add
  - sheet upload import
  - sale recording
- Verify role checks on all privileged mutations.
- Ensure audit logging includes tenant context and actor.
- Add idempotency for mutation endpoints where needed.

## Deliverables

- Authorization guards and tenancy filters reviewed/updated.
- Audit payload consistency across all mutation paths.

## Done When

- Unauthorized access is blocked in all target flows.
- Mutations are traceable and resilient to retries.

---

## PLAN-7 — QA, Regression, Rollout, and Monitoring

## Goal

Ship safely with measurable confidence and rollback readiness.

## Scope

- Add/update unit and integration tests for new/changed flows.
- Perform manual UAT with scanner and sheet files.
- Validate no regressions in existing inventory behavior.
- Prepare rollout notes and toggle strategy (if feature-flagged).

## Test Matrix (minimum)

- Single add happy path
- Single add duplicate rejection
- Bulk add mixed valid/invalid
- Sheet upload:
  - missing headers
  - missing row identifiers
  - duplicate in file
  - duplicate in DB
- Sale flow:
  - exact match search
  - sell success
  - sell blocked for sold status
- RBAC/tenancy negative cases

## Deliverables

- Test updates and verification checklist.
- Release checklist and rollback notes.

## Done When

- Critical flows pass tests and UAT.
- Production rollout checklist is complete.

---

## Phase Command Contract (for future prompts)

Use any of these exact commands:

- `Implement PLAN-0`
- `Implement PLAN-1`
- `Implement PLAN-2`
- `Implement PLAN-3`
- `Implement PLAN-4`
- `Implement PLAN-5`
- `Implement PLAN-6`
- `Implement PLAN-7`

Agent execution behavior for each command:

1. Confirm phase scope from this file.
2. Implement phase end-to-end only.
3. Run lint/type checks for touched files.
4. Share:
   - changed files
   - validation done
   - how to verify
5. Stop and wait for your approval for next phase.

---

## Coding and Design Standards Checklist (apply every phase)

- TypeScript strictness and clear domain types.
- Alphabetically sorted imports.
- Early returns for readable control flow.
- Reuse existing UI components and interaction patterns.
- Accessibility:
  - labels
  - keyboard handling
  - aria attributes where needed
- No ad-hoc styling system; keep Tailwind + current design standards.
- Preserve behavior outside requested phase scope.
- No destructive git or historical migration rewrites.

---

## One-Shot Reliability Guardrails

To maximize first-pass success and avoid errors:

- Resolve all business-rule ambiguities in `PLAN-0`.
- Keep each phase small but complete (schema/API/UI/validation as needed).
- Prefer additive-compatible changes.
- Add row-level, actionable error messages for import and bulk flows.
- Verify with both happy-path and failure-path tests before phase completion.
