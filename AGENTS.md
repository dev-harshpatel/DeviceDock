<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

This file defines implementation rules for AI agents working in this repository.
Follow these instructions for every change unless a user explicitly overrides them.

## Mandatory Companion Docs

Agents must also follow:
- `docs/DESIGN.md` (admin UI/UX and responsive design rules)

---

## 1) Project Identity

- **App type:** Inventory management platform
- **Frontend:** Next.js App Router + React + TypeScript
- **UI:** Tailwind + shadcn/ui + Radix primitives
- **Backend/data:** Supabase (PostgreSQL), no Prisma
- **State/data layer:** React Context + TanStack Query (where already used)
- **Styling goal:** Keep existing UI patterns; improve, do not reinvent

---

## 2) Core Principles

- Preserve behavior unless the task explicitly asks for behavior changes.
- Make small, reversible, well-scoped edits.
- Prioritize readability and maintainability over cleverness.
- Avoid broad refactors while delivering feature work.
- Keep changes consistent with existing architecture and naming.

---

## 3) Folder and File Conventions

Use the existing structure and extend it rather than creating ad hoc folders.

- `app/`  
  Route pages and API route handlers.
- `src/page-components/`  
  Page-level UI compositions.
- `src/components/`  
  Reusable UI pieces (modals, tables, sheets, common, ui).
- `src/contexts/`  
  Client state + domain actions.
- `src/lib/`  
  Query/mapping/helpers/constants/tax/invoice utilities.
- `src/types/`  
  Shared domain types.
- `supabase/migrations/`  
  Ordered SQL migrations only.
- `docs/`  
  Planning and operational docs.

### Placement rules

- New visual UI building block -> `src/components/...`
- New page-level orchestration -> `src/page-components/...`
- New domain utility -> `src/lib/...`
- New DB schema/data fix -> `supabase/migrations/...`
- New TS type used in >1 place -> `src/types/...`

---

## 4) TypeScript and Safety Standards

- Use strict typing; avoid `any` and `unknown` unless absolutely unavoidable.
- Prefer explicit interfaces/types for payloads, rows, DTOs.
- Use null-safe and undefined-safe checks for DB values.
- Use early returns to reduce nested branching.
- Keep functions focused and short where practical.

### Imports

- Keep imports alphabetically sorted (group by external -> internal).
- Remove unused imports immediately.

---

## 5) UI/UX Standards

- Reuse existing shadcn/ui controls and style language.
- Do not introduce one-off design systems or custom CSS files unless required.
- Prefer Tailwind utility classes and existing helper utilities (`cn`, etc.).
- Keep table numeric columns right-aligned and consistent.
- Maintain accessibility:
  - proper labels
  - keyboard support for interactive elements
  - meaningful `aria-label`/titles where needed

---

## 6) Modularity and Reuse

- Extract repeated calculation logic into `src/lib/...` helpers.
- Keep UI rendering and business logic separated when complexity grows.
- Do not duplicate pricing/tax formulas in multiple places without a shared helper.
- Prefer composition over large monolithic components.

---

## 7) Comments and Documentation

- Add comments only where logic is non-obvious.
- Comment **why**, not **what**.
- Keep comments concise and accurate; remove stale comments during edits.
- For complex flows (inventory math, tax, status transitions), include a short formula note.

---

## 8) Database and Migration Rules

- All DB changes must be additive and migration-driven.
- Never rewrite historical migrations; create a new migration file.
- Migration file naming:
  - sequential prefix (e.g. `045_...sql`)
  - clear, action-oriented suffix
- For data fixes:
  - make them idempotent where possible
  - include safe `WHERE` guards
  - avoid touching unrelated columns
- If the change affects financial logic, include a quick validation query in PR notes.

---

## 9) Domain Rules (Inventory/Cost/Tax)

- `purchase_price`: total base cost for current remaining units.
- `price_per_unit`: per-unit cost including tax/HST (derived).
- `selling_price`: sales price per unit.
- On quantity decrease, purchase price must scale proportionally.
- On quantity zero, purchase price should be zero unless a task explicitly states otherwise.
- Keep tax-included vs tax-excluded labels explicit in UI.

---

## 10) API and Data Access Rules

- Reuse existing Supabase clients (`browser`, `server`, `admin`) correctly.
- Keep admin-only operations in admin-authorized paths.
- Avoid raw inline query duplication; prefer existing query helpers/mappers.
- Preserve snake_case <-> camelCase mapping conventions.

---

## 11) Editing Existing Code

- Do not remove unrelated logic.
- Do not rename public symbols unless necessary.
- Do not introduce breaking behavior changes outside task scope.
- If you must change behavior, document impact clearly in summary.

---

## 12) Quality Gates Before Completion

For substantive changes:

1. Run lint checks for touched files/workspace as needed.
2. Verify no TypeScript errors introduced.
3. Validate affected UI flow manually (or provide exact verification steps).
4. Confirm no accidental schema or API contract regressions.

---

## 13) Git and Delivery Behavior

- Make minimal, coherent changes per task.
- Do not commit unless explicitly requested by the user.
- If committing is requested, use clear message describing intent and impact.
- Never force push or run destructive git commands unless explicitly asked.

---

## 14) Phase-Based Implementation Protocol

When working from a phased plan:

- Implement one phase fully end-to-end.
- Include schema/API/UI/validation for that phase.
- Stop after completion and request approval before next phase.
- If a phase is too large, split into sub-phases (A/B/C) with shippable outcomes.

---

## 15) What to Avoid

- Large unrequested refactors
- New dependencies without clear need
- Duplicated formulas/logic
- Hidden data mutations without UI/state refresh
- Ambiguous labels for currency/tax-sensitive fields

---

## 16) Definition of Done

A task is done when:

- Requested behavior is implemented end-to-end.
- Existing behavior outside scope is preserved.
- Lints/checks pass for touched areas.
- Any migration/data fix is safe and scoped.
- Summary includes what changed and how to verify.

