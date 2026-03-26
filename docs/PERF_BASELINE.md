# Performance Baseline (repeatable)

This doc defines a **repeatable before/after checklist** so we can prove performance improvements without changing the app’s behavior.

---

## What we measure

- **Build output & chunk sizes**: confirm heavy libs are not in shared bundles.
- **Web Vitals**:
  - **LCP** (Largest Contentful Paint): initial content speed
  - **INP** (Interaction to Next Paint): how responsive clicks/typing feel
  - **CLS** (Cumulative Layout Shift): layout stability
- **Route timings** (human verification):
  - time to interactive feel on key routes
  - export/generate actions responsiveness

---

## Key routes to benchmark (pick the ones you use most)

- **Inventory list**: `/admin/inventory` and/or `/[companySlug]/inventory`
- **Orders list**: `/admin/orders` and/or `/[companySlug]/orders`
- **Invoice**: invoice page route (admin + tenant scoped)
- **Products/users/settings**: only if those feel slow in real usage

---

## Baseline procedure (before and after any perf task)

### 1) Production build + run

Run:

```bash
npm run build
npm run start
```

Then open the app in a fresh browser session (ideally Incognito).

---

### 2) Quick manual checks (behavior + perceived speed)

On each key route:

- **Initial load**
  - Does content appear quickly?
  - Any obvious layout shifts?
- **Common interactions**
  - Open/close dialogs and popovers
  - Change filters/search/sort if present
  - Navigate to details and back
- **Exports**
  - Trigger Excel/PDF export (confirm UI remains responsive)
  - Confirm generated files are correct (same filename + content expectations)

Record a short note for each route: “fast / ok / slow” + where it feels slow.

---

### 3) Web Vitals capture (Vercel Analytics / Speed Insights)

This repo already includes:

- `@vercel/analytics`
- `@vercel/speed-insights`

Use those dashboards to compare:

- **Before**: current `development` branch baseline
- **After**: branch with perf changes

Focus on LCP + INP for the key routes above.

---

## Acceptance criteria for perf tasks

- **No behavior change**: guards, navigation, toasts, exports remain consistent.
- **Measurable win**: at least one of:
  - smaller shared chunks / heavy libs moved out of shared chunks
  - improved INP on export/generate
  - fewer refetch storms / smaller payloads
  - faster perceived interaction on the slow routes
