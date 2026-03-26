# Performance Tasks (execute one-by-one)

Use this file as the “menu” of work. Tell me **exactly one task ID** (example: “Do `P1`”), and I’ll implement it end-to-end while keeping the **same flow/behavior**.

---

## Ground rules (for every task)

- **Behavior must stay the same**: same UI states, same navigation/guards, same toasts, same exports output.
- **Measure before/after** when applicable (bundle size, route timings, Web Vitals).
- **Prefer minimal, localized changes** and reuse existing UI + logic.

---

## P0 — Baseline & visibility (recommended first)

### P0.1 — Create a repeatable perf baseline

- **Goal**: make “fast/slow” measurable in this repo.
- **Work**:
  - Document how to capture before/after (build output, Web Vitals routes).
  - Add a short checklist to run locally before/after changes.
- **Done when**:
  - There is a clear baseline procedure in `docs/` and it’s easy to repeat.

### P0.2 — Add bundle inspection workflow (no behavior change)

- **Goal**: quickly verify heavy libs aren’t in shared chunks.
- **Work**:
  - Add an optional bundle inspection script/workflow (dev-only) so we can see chunk composition.
- **Done when**:
  - We can inspect which chunks include `xlsx`, `jspdf`, `jspdf-autotable`, `@react-pdf/renderer`.

---

## P1 — Biggest wins: keep heavy libs out of the initial bundle

### P1.1 — Lazy-load inventory PDF export (jsPDF) at click time

- **Goal**: `jspdf` + `jspdf-autotable` are not shipped to users unless they export.
- **Likely files**:
  - `src/lib/export/pdf.ts`
  - Any component that triggers PDF export (export buttons/actions)
- **Work**:
  - Replace eager imports with `await import(...)` from the click handler (or a tiny wrapper).
  - Keep the same success/failure behavior and toast messaging.
- **Done when**:
  - Production build shows PDF libs are not in common/shared chunks.
  - Export still produces the identical PDF (content + filename conventions).

### P1.2 — Lazy-load inventory Excel export (xlsx) at click time

- **Goal**: `xlsx` is not shipped to users unless they export.
- **Likely files**:
  - `src/lib/export/excel.ts`
  - Any component that triggers Excel export
- **Work**:
  - Move `xlsx` import to a dynamic import path.
  - Preserve export output and filename conventions.
- **Done when**:
  - `xlsx` is not in the default chunk(s).
  - Export still works for large datasets without UI jank regressions.

### P1.3 — Isolate invoice PDF generation to invoice-only routes

- **Goal**: `@react-pdf/renderer` is only loaded on invoice routes, not across admin pages.
- **Likely files**:
  - `src/lib/invoice/pdf.tsx`
  - Invoice pages under `app/**/orders/**/invoice/page.tsx`
- **Work**:
  - Ensure invoice generator is imported only within invoice route / on-demand.
  - Avoid shared “barrel exports” that accidentally pull it into other routes.
- **Done when**:
  - Admin pages unrelated to invoices don’t include `@react-pdf/renderer` in their chunks.
  - Invoice generation behavior is unchanged.

---

## P2 — Interaction performance: stop UI freezes during export/generation

### P2.1 — Add non-blocking “Generating…” UX to exports (same flow)

- **Goal**: prevent perceived freezes and improve INP.
- **Likely files**:
  - Export action components (e.g. `src/components/common/ExportActions.tsx`)
- **Work**:
  - Disable export buttons while running.
  - Show loading state and keep toasts consistent.
  - Yield to the browser before heavy work where appropriate.
- **Done when**:
  - Clicking export never freezes the UI; user gets immediate feedback.

### P2.2 — Cache invoice logo data-url per session

- **Goal**: avoid refetching/converting the same logo for every invoice generation.
- **Likely files**:
  - `src/lib/invoice/pdf.tsx`
- **Work**:
  - Add an in-memory cache keyed by `companyId` (or logo URL/path).
  - Preserve correctness when logo changes (safe cache invalidation).
- **Done when**:
  - Re-generating invoices is faster and does fewer network requests.

### P2.3 — (Optional) Web Worker for `xlsx` export on very large datasets

- **Goal**: keep main thread responsive when exporting huge inventories.
- **Work**:
  - Move heavy XLSX generation to a Worker.
  - Keep output identical.
- **Done when**:
  - Export remains responsive even for very large data.

---

## P3 — Rendering: reduce unnecessary re-renders

### P3.1 — Stabilize props/handlers in biggest admin pages

- **Goal**: reduce rerenders caused by unstable props and inline objects/functions.
- **Candidate pages**:
  - `/admin/inventory`, `/admin/orders`, `/admin/users` (and the tenant-scoped equivalents)
- **Work**:
  - `useMemo` for derived arrays/objects.
  - `useCallback` for handlers passed to memoized children.
  - `React.memo` for heavy components (tables, dialogs, popovers).
- **Done when**:
  - Render count and interaction latency visibly improve without changing UI behavior.

### P3.2 — Paginate or virtualize large tables (pick the safest approach per screen)

- **Goal**: avoid rendering hundreds/thousands of rows at once.
- **Work**:
  - Pagination preferred; virtualization if “must show all”.
- **Done when**:
  - Large inventories/orders stay snappy with consistent UX.

---

## P4 — Data: fewer requests, smaller payloads, stable caching

### P4.1 — Remove `select("*")` in list views (fetch only needed columns)

- **Goal**: reduce payload size and speed up list screens.
- **Likely files**:
  - `src/lib/supabase/queries/*.ts`
- **Work**:
  - Use explicit `.select("...")` for list queries.
  - Fetch extra fields on-demand in details views if needed.
- **Done when**:
  - Network payload is smaller; UI remains identical.

### P4.2 — React Query tuning (staleTime/gcTime/refetch storms)

- **Goal**: fewer redundant refetches while preserving correctness.
- **Work**:
  - Set sensible `staleTime` per query type.
  - Ensure precise invalidation after mutations (avoid “invalidate everything”).
  - Consider disabling `refetchOnWindowFocus` only where safe.
- **Done when**:
  - Navigation feels instant; data correctness remains the same.

### P4.3 — Prefetch on navigation intent for order/inventory details

- **Goal**: details pages open faster without changing flow.
- **Work**:
  - Prefetch queries on hover / on row focus / on click before route push.
- **Done when**:
  - Time-to-content on details routes improves measurably.

---

## P5 — DB & API speed (only if data is the bottleneck)

### P5.1 — Add/verify indexes for hot filters

- **Goal**: speed up the slowest queries (especially admin lists).
- **Work**:
  - Identify slow queries first.
  - Add indexes for columns frequently filtered/sorted (e.g. `company_id`, `created_at`, `status`, `user_id`).
- **Done when**:
  - Slow queries improve in `EXPLAIN ANALYZE` and user-visible latency.

---

## How you can command me

- “Do `P0.2`”
- “Do `P1.2`”
- “Do `P2.2`”

If you’re unsure where to start: **do `P0.2` first**, then **`P1.1`**, then **`P1.2`**, then **`P1.3`**.
