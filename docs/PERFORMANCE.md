# Performance Guide (keep behavior same)

This app is **Next.js 14 (App Router)** + **Supabase** + **React Query**, with **client-side PDF/Excel generation** (jsPDF/xlsx/@react-pdf). “Lightning fast” here means:

- **Fast initial load**: smallest JS shipped, fastest server responses, fastest hydration.
- **Fast interactions**: minimal unnecessary React re-renders, avoid main-thread blocking work.
- **Fast data**: fewer requests, smaller payloads, stable caching, correct invalidation.
- **Same flow/behavior**: optimizations must not change user-visible outcomes.

---

## How to approach this (pseudocode plan)

```text
Goal: reduce TTFB, LCP, INP, JS bundle, and main-thread stalls without changing behavior.

1) Measure (baseline)
   - Run production build
   - Capture Web Vitals (LCP/INP/CLS) and slow routes
   - Identify biggest JS chunks and heaviest client components
   - Identify slow Supabase queries and chatty request patterns

2) Fix biggest bottlenecks first (80/20)
   - If export/invoice blocks UI: move work off main thread + lazy-load heavy libs
   - If pages re-render often: memoize + stabilize props + split components
   - If data fetching is redundant: tune React Query keys, staleTime, prefetch, and batching
   - If payloads are big: minimize select fields, paginate, and avoid sending JSON blobs

3) Verify behavior
   - Ensure same UI states, same toasts, same navigation/guards
   - Validate exports match previous output
   - Compare before/after vitals and route timings

4) Guardrails
   - Add repeatable perf checks: bundle analyzer + vitals dashboards + slow-query logging
```

---

## Highest ROI optimizations (do these first)

### 1) Keep heavy libraries out of the initial bundle

**Why it matters:** `xlsx`, `jspdf`, `jspdf-autotable`, and `@react-pdf/renderer` are large. If they’re imported in code that can be reached by default page loads, users pay that cost even when they never export.

- **Lazy-load PDF/Excel exporters**:
  - Move export functions behind `await import(...)` inside the click handler.
  - Keep the UI button immediate; load the library only when user triggers export.
- **Split “invoice PDF generation” into a dedicated client chunk**:
  - Ensure invoice pages/components don’t pull PDF libs into unrelated admin pages.
- **Prefer “route-level” isolation**:
  - If invoice is on `/admin/orders/[orderId]/invoice`, ensure those imports are only used there.

**Quick check:** after `next build`, inspect the output chunk sizes and confirm exports aren’t in common chunks.

---

### 2) Don’t block the main thread for “export / generate”

**Why it matters:** generating PDFs and XLSX can freeze the UI (bad INP).

- **Run export work outside of urgent UI updates**:
  - Disable button immediately, show “Generating…”, then do the work.
- **Offload when possible**:
  - For Excel generation with `xlsx`, consider a **Web Worker** for large datasets.
  - For PDF generation, at minimum: lazy-load libs + yield to the browser before heavy work.
- **Paginate exports** (if exports are huge):
  - Export the filtered subset by default, or stream/paginate server-side (only if it preserves intended behavior).

---

### 3) Make server work server-side (and cache it)

**Why it matters:** App Router shines when expensive logic stays on the server and the client only renders.

- **Use Server Components by default** for pages that don’t need client interactivity.
- **Use Route Handlers** (`app/api/*`) for:
  - Aggregations for dashboards
  - “Reports” endpoints
  - Any “download file” generation (when feasible)
- **Cache stable server responses**:
  - Use `fetch` caching/revalidation where appropriate for public/static data.
  - For admin data that must be fresh, still avoid refetch storms (see React Query section).

---

### 4) Reduce unnecessary React re-renders

**Why it matters:** big admin pages with tables, dialogs, and popovers can re-render frequently.

Practical patterns that preserve behavior:

- **Split large pages into smaller components**:
  - Put tables, modals, and heavy sections into separate components so state changes are localized.
- **Stabilize props**:
  - Wrap derived arrays/objects in `useMemo`.
  - Wrap handlers in `useCallback` when passed deep into memoized children.
- **Use `React.memo` strategically**:
  - On table rows, popovers, dialog bodies—especially when they receive stable props.
- **Avoid “global state causes whole page rerender”**:
  - Prefer localized state, or selectors (if using Zustand/contexts) to prevent broad updates.

**Red flag:** passing inline objects like `{}` / `[]` / `() => {}` into many children on each render.

---

### 5) Optimize large lists/tables

**Why it matters:** inventory/orders/users screens can have hundreds/thousands of rows.

- **Pagination** (preferred, simplest, preserves behavior most safely):
  - fetch page \(N\) with limit; show total.
- **Virtualization** (when you must show “all”):
  - Use windowing so only visible rows render.
  - Keep row height stable if possible.

---

## Data & Supabase (keep it fast and consistent)

### 6) Minimize payloads (select only what the UI needs)

- **Use explicit `.select("col1,col2,...")`** instead of `select("*")`.
- **Avoid large JSONB blobs** in list views (load details on demand).
- **Paginate** list queries (inventory/orders/users).

---

### 7) Tune React Query for fewer network trips

Use these levers to keep the flow the same but reduce refetch:

- **`staleTime`**: if the page doesn’t require second-by-second freshness, set a reasonable stale window.
- **`gcTime`**: keep cached data around longer to avoid refetch when navigating back.
- **`refetchOnWindowFocus`**: consider disabling on heavy admin pages if it causes surprise refetch storms.
- **Invalidate precisely** after mutations:
  - invalidate only affected keys rather than “invalidate everything”.
- **Prefetch** on navigation intent:
  - prefetch order details on hover/click before route transition.

---

### 8) Make queries index-friendly (DB)

Even with perfect frontend, a slow query will dominate. Common wins:

- **Add indexes for frequent filters**: `company_id`, `created_at`, `status`, `user_id`.
- **Avoid N+1**:
  - batch fetch related entities or use RPC/views when appropriate.
- **Measure slow queries**:
  - use Postgres `EXPLAIN (ANALYZE, BUFFERS)` for the worst offenders.

---

## Next.js-specific optimizations

### 9) Route-level code splitting and client boundary discipline

- Keep `"use client"` as **low** as possible in the component tree.
- Don’t import client-only libraries in Server Components.
- If a page needs a small interactive widget, make only that widget a Client Component.

---

### 10) Images, fonts, and third-party scripts

- Use `next/image` for all product/company images where possible.
- Avoid loading large images in tables; use small thumbnails and lazy loading.
- Audit font loading (only weights/styles you need).
- Remove/defang unused third-party libs; defer non-critical scripts.

---

## Exports & PDFs (your biggest “feels slow” area)

### 11) Inventory exports (jsPDF/xlsx)

Current structure shows exports are implemented as utilities (good), but the key is **when they get imported**.

Recommended behavior-preserving pattern:

- UI button click:
  - show loading state
  - `await import("./pdf")` or `await import("./excel")`
  - execute export
  - show toast result

This keeps the normal browsing/admin flow fast and only pays the cost when exporting.

---

### 12) Invoice generation (`@react-pdf/renderer`)

Invoice generation can be expensive and may also do network fetches (logo conversion to base64).

Wins that preserve behavior:

- **Cache logo data URL** per company for the session (memory cache) to avoid refetching for every invoice.
- **Lazy-load invoice renderer** on invoice route only.
- Ensure the invoice page isn’t forcing PDF libs into other admin pages (bundle isolation).

---

## Instrumentation (so “fast” stays fast)

### 13) Bundle size and regressions

- Add a repeatable step to check chunk sizes.
- Consider enabling a bundle analyzer in a dedicated script so you can see:
  - which packages are in the heaviest chunks
  - whether export/pdf libs leak into shared bundles

---

### 14) Runtime metrics

You already have `@vercel/analytics` and `@vercel/speed-insights` available.

- Track **LCP** and **INP** on the most-used routes:
  - `/admin/inventory`
  - `/admin/orders`
  - invoice page route
- Track slow API route timings (server logs / APM).

---

## “Do not do” list (common ways to break behavior)

- Don’t increase cache windows on data that must be real-time for correctness.
- Don’t “optimistically update” complex order/inventory flows unless you fully model rollback.
- Don’t move logic from client → server if it changes auth context/permissions behavior.
- Don’t remove refetches that the UI relies on for consistency after mutations—prefer **precise invalidation**.

---

## Suggested implementation checklist (ordered)

- **Bundle isolation**
  - [ ] Make PDF/Excel generation lazy-loaded from UI click
  - [ ] Verify invoice route does not leak PDF libs into other chunks
- **Interaction performance**
  - [ ] Add “Generating…” states + yield before heavy work
  - [ ] Workerize `xlsx` export if datasets are large
- **Rendering**
  - [ ] Split heavy pages into smaller components
  - [ ] Memoize heavy derived data + stabilize handlers
  - [ ] Paginate or virtualize large tables
- **Data**
  - [ ] Remove `select("*")` in list views; fetch only needed columns
  - [ ] Tune React Query `staleTime/gcTime` + precise invalidation
  - [ ] Add/verify DB indexes for hot filters
