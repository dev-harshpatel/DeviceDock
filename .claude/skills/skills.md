# Stoq — Engineering Standards & Coding Guidelines

You are a senior engineer working on Stoq. Follow these standards rigorously in every response. When writing code, think about modularity, reusability, consistency, and responsiveness. Every piece of code you write should feel like it belongs in the existing codebase.

---

## 1. Architecture & Modularity

### File Organization Rules
- **App router pages are thin shells only.** A `page.tsx` in `app/` should be 3–7 lines max — import and render a component from `src/page-components/`.
- **Page components** go in `src/page-components/`. These are the real implementations.
- **Shared components** go in `src/components/` (flat — no nested feature folders). Only shadcn primitives go in `src/components/ui/`.
- **Contexts** go in `src/contexts/`, with the custom hook co-located at the bottom of the same file.
- **Custom hooks** go in `src/hooks/`, file names in `use-kebab-case.ts`.
- **Supabase queries** go in `src/lib/supabase/queries/`, split by domain (inventory, orders, users, stats, cart). Mapper functions live in `mappers.ts`.
- **Types** go in `src/types/` for domain models, `src/lib/types/` for internal lib types, and `src/lib/database.types.ts` for DB types.
- **Utilities** go in `src/lib/utils/`. Constants in `src/lib/constants/`. Validations in `src/lib/validations/`.

### Component Modularity
- **Single Responsibility**: Each component does one thing. A modal doesn't fetch data — it receives it via props. A table doesn't manage filters — it receives filtered data.
- **Extract early**: If a block of JSX is repeated twice or a component exceeds ~200 lines, extract a sub-component.
- **Props over context**: Prefer passing props for data that flows 1–2 levels. Use context only for truly global state (auth, cart, inventory).
- **Compose, don't inherit**: Build complex UIs by composing small components, not by creating mega-components with many conditional branches.

---

## 2. Component Conventions

### Naming & Exports
- **Named exports** for all components: `export function FilterBar(...)` or `export const CartModal = ...`.
- **Default exports** only for Next.js pages (`app/` route files) and page-components.
- **Performance-sensitive leaf components** use `memo`: `export const StatCard = memo(function StatCard(...))`.

### Props Interface
- Always define a local `interface {ComponentName}Props` immediately before the component.
- Export the interface only if other files need it.
- Use `?` for optional props with sensible defaults in destructuring.

```tsx
interface FilterBarProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onReset: () => void;
  className?: string;
  brands?: string[];
}

export function FilterBar({ filters, onFiltersChange, onReset, className, brands = [] }: FilterBarProps) { ... }
```

### State Management
- Use multiple `useState` calls for independent state — don't combine into one object.
- Wrap callbacks in `useCallback` when passed as props to child components or used in dependency arrays.
- Use `useMemo` for expensive computations, not for every derived value.

### Event Handlers
- Name handlers as `handle{Action}`: `handleSubmit`, `handleFilterChange`, `handleDelete`.
- Define handlers inside the component, not inline in JSX (except trivial one-liners like `() => setOpen(false)`).

---

## 3. Context & Hook Patterns

### Context Structure (mandatory pattern)
```tsx
"use client";

interface XContextType { /* ... */ }

const XContext = createContext<XContextType | undefined>(undefined);

export const XProvider = ({ children }: { children: ReactNode }) => {
  // state, callbacks, effects
  return <XContext.Provider value={{ ... }}>{children}</XContext.Provider>;
};

export const useX = () => {
  const context = useContext(XContext);
  if (context === undefined) throw new Error("useX must be used within an XProvider");
  return context;
};
```

### When context is optional
If a component may render outside a provider, access context directly:
```tsx
const ordersContext = useContext(OrdersContext);
const orders = ordersContext?.orders || [];
```

---

## 4. Supabase & Data Layer

### Query Functions
- Standalone `async function` — not class methods.
- Always throw on error: `if (error) throw error;`
- Always map rows through `dbRowToInventoryItem` / `dbRowToOrder` etc. from `mappers.ts`.
- Use `{ count: "exact" }` in select for paginated queries.
- Apply filters via a dedicated `applyXFilters(query, filters)` helper.

### DB ↔ TS Mapping
- DB: `snake_case`. TypeScript: `camelCase`. Always use mapper functions — never access raw DB rows directly in components.
- Write operations use `toXUpdate()` mappers that convert camelCase to snake_case and only include defined fields.

### TanStack Query
- All query keys go through the factory in `src/lib/query-keys.ts` — never inline query key arrays.
- Use `keepPreviousData` for paginated queries.
- Use `staleTime: Infinity` for data that rarely changes (filter options, brands list).

---

## 5. UI & Styling Standards

### Tailwind Conventions
- **Never use raw color names** (no `bg-blue-500`, `text-red-600`). Always use semantic tokens:
  - Backgrounds: `bg-card`, `bg-background`, `bg-muted`
  - Text: `text-foreground`, `text-muted-foreground`, `text-primary`
  - Borders: `border-border`
  - Status: `text-success`, `text-destructive`, `text-warning`
  - Tables: `bg-table-hover`, `bg-table-zebra`
- **Always use `cn()`** from `@/lib/utils` for conditional/merged classes. Never use template literals for conditional classes.

```tsx
// CORRECT
className={cn("p-4 rounded-lg", isActive && "bg-primary text-primary-foreground", className)}

// WRONG
className={`p-4 rounded-lg ${isActive ? "bg-blue-500 text-white" : ""}`}
```

### Spacing & Layout
- Card padding: `p-4` mobile, `p-6` desktop.
- Section gaps: `gap-4`, `space-y-4`.
- Cards: `rounded-lg border border-border bg-card shadow-soft`.
- Sticky headers: `sticky top-0 z-10 bg-background`.
- Scrollable containers: `flex flex-col h-full` with `flex-1 min-h-0 overflow-auto`.

### shadcn/ui Usage
- Always use shadcn components for inputs, buttons, dialogs, selects, etc. — never build custom versions.
- Import from `@/components/ui/button`, `@/components/ui/input`, etc.
- For forms: `<Label>` + `<Input>` wrapped in `<div className="space-y-2">`.

---

## 6. Responsive Design (Critical)

### Dual-Render Pattern for Tables
Every data table MUST have two completely separate renders:

```tsx
{/* Desktop — hidden below md */}
<div className="hidden md:flex md:flex-col">
  <table>...</table>
</div>

{/* Mobile cards — hidden at md and above */}
<div className="md:hidden space-y-3">
  {items.map(item => (
    <div key={item.id} className="p-4 bg-card rounded-lg border border-border">
      {/* Card layout with key info */}
    </div>
  ))}
</div>
```

### Breakpoint Strategy
- Primary breakpoint: `md:` (768px) — mobile vs desktop split.
- `sm:` for minor adjustments (stack → row).
- `lg:` for wider layouts (padding, grid columns).
- Mobile-first: write base styles for mobile, then add `md:` / `lg:` overrides.

### Mobile Patterns
- Mobile filters use a bottom sheet (fixed inset-0 backdrop + fixed bottom panel).
- Stat cards: `grid grid-cols-2 md:grid-cols-4 gap-4`.
- Actions: full-width buttons on mobile, inline on desktop.
- Modals: full-screen on mobile (`sm:max-w-md` or `sm:max-w-2xl` for desktop sizing).

---

## 7. Form & Modal Patterns

### Modal Props Contract
Every modal component must accept:
```tsx
interface XModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // ... other data props
}
```
Modals never manage their own open state — the parent controls it.

### Form Submission Pattern
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // 1. Validate with early return + toast
  if (!isValid) {
    toast.error(TOAST_MESSAGES.VALIDATION_ERROR);
    return;
  }

  setIsLoading(true);
  try {
    await performAction();
    toast.success(TOAST_MESSAGES.SUCCESS);
    resetForm();
    onOpenChange(false);
  } catch (error) {
    const message = error instanceof Error ? error.message : TOAST_MESSAGES.GENERIC_ERROR;
    toast.error(message);
  } finally {
    setIsLoading(false);
  }
};
```

### Zod Validation
- Define schemas in `src/lib/validations/`.
- Infer types: `type FormData = z.infer<typeof formSchema>`.
- Compose schemas via `.shape` spread for multi-step forms.

---

## 8. Error Handling & Loading States

### Loading UI Hierarchy
| Scenario | Pattern |
|---|---|
| Full page loading | `<Loader size="lg" text="Loading..." />` as early return |
| Table data loading | `<TableSkeleton />` |
| Button action in progress | `<Button disabled={isLoading}>{isLoading ? "Processing..." : "Submit"}</Button>` |
| Inline value loading | `<Loader2 className="h-4 w-4 animate-spin inline" />` |

### Error Strategy
- **Toast-first**: Surface errors via `toast.error()` — not inline error text (except form field validation).
- **Error extraction**: Always use `error instanceof Error ? error.message : FALLBACK_MESSAGE`.
- **Toast messages**: Import from `TOAST_MESSAGES` in `src/lib/constants/toast-messages.ts` — never hardcode toast strings.

### Empty States
- Use the `<EmptyState />` component for zero-data scenarios.
- Guard with `if (items.length === 0) return <EmptyState />`.

---

## 9. Constants & Magic Values

- **No magic numbers or strings.** Extract to `src/lib/constants/index.ts`.
- **Toast messages** go in `src/lib/constants/toast-messages.ts` as the `TOAST_MESSAGES` object.
- **Sort orders, batch sizes, debounce delays** — all in constants.
- **Dynamic toast messages** use factory functions: `ORDER_PLACED: (id: string) => \`Order #${id.slice(-8)} placed\``.

---

## 10. TypeScript Standards

### Type Definitions
- Use `interface` for object shapes that may be extended. Use `type` for unions, intersections, and aliases.
- String literal unions for status fields: `type OrderStatus = "pending" | "approved" | "rejected" | "completed"`.
- Always pass the `Database` generic to Supabase clients for type safety.

### Type Safety Rules
- Never use `any`. Use `unknown` if the type is truly unknown, then narrow.
- Always type function parameters and return types for exported functions.
- Use `as const` for constant objects and arrays to preserve literal types.
- Prefer `Record<string, T>` over `{ [key: string]: T }`.

---

## 11. Code Quality Checklist

Before finishing any code, verify:

- [ ] **Modularity**: Is the component doing one thing? Could any part be extracted?
- [ ] **Reusability**: Am I duplicating logic that already exists in a utility or hook?
- [ ] **Responsiveness**: Does it work on mobile AND desktop? Tables have dual-render?
- [ ] **Semantic tokens**: Am I using `bg-card`, `text-foreground` etc. — no raw colors?
- [ ] **cn()**: All conditional classes use `cn()`, not template literals?
- [ ] **Props interface**: Defined, named `{Component}Props`, placed before the component?
- [ ] **Error handling**: try/catch with toast feedback? Loading states on async actions?
- [ ] **Constants**: No magic strings/numbers? Toast messages from `TOAST_MESSAGES`?
- [ ] **Type safety**: No `any`? Proper mapper functions for DB ↔ TS?
- [ ] **Existing patterns**: Does this follow how similar things are already done in the codebase?
- [ ] **`"use client"`**: Added if using hooks, context, or browser APIs?
- [ ] **Accessibility**: Proper `htmlFor` on labels? `disabled` on loading buttons? Keyboard navigable?

---

## 12. What NOT to Do

- Do not create new utility CSS classes when Tailwind tokens exist.
- Do not put business logic in `app/` route files — those are thin shells only.
- Do not access raw Supabase rows in components — always go through mappers.
- Do not inline query keys — use the `queryKeys` factory.
- Do not create new contexts unless the state is truly global and used across multiple unrelated components.
- Do not use `useEffect` for derived state — use `useMemo` or compute inline.
- Do not mix `async/await` with `.then()` chains in the same function.
- Do not hardcode currency, timezone, or locale — use formatters from `src/lib/utils/formatters.ts`.
- Do not skip the dual mobile/desktop render for tables and data lists.
- Do not use `console.log` in production code — remove all debug logs before finishing.
