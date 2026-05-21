# DeviceDock — Application Audit

> Generated: 2026-05-20  
> Scope: Full codebase — bugs, re-renders, DB calls, memory leaks, UX, architecture

---

## Priority Order for Fixing

1. ~~**BUG-02**~~ ✅ — Invoice retry loop: silently fails, wrong error surfaced to users
2. ~~**RENDER-01**~~ ✅ — `UserProfileContext` no `useMemo`: cascading re-renders on every auth state change
3. ~~**BUG-03**~~ ✅ — Approval flow dead code fully removed from codebase
4. ~~**DB-05**~~ ✅ — N+1 queries in `ManualSaleWizard`: noticeable latency for multi-item sales
5. ~~**DB-02**~~ ✅ — Dashboard `staleTime: 0`: fires RPC on every mount
6. ~~**BUG-01**~~ ✅ — `UserProfileContext` stale closure: subtle double-fetch and skipped load bugs

---

## 1. Bugs / Silent Failures

---

### ~~BUG-01~~ ✅ FIXED — `UserProfileContext`: `loadProfile` stale closure over `profile` causes skipped loads

**File:** `src/contexts/UserProfileContext.tsx` — lines 36–71  
**Severity:** High

`loadProfile` is a plain `async` function recreated on every render. The early-return guard `if (profile?.userId === userId)` closes over the `profile` snapshot from the render that created the function. In React 18 Strict Mode (double-invoke), the second invocation sees the same stale `profile` reference as the first and incorrectly skips the fetch.

The function is also used in `refreshProfile` and a `useEffect`, but because it has no stable identity, the deps list works around the issue by listing `user?.id` and `authLoading` only — hiding the underlying stale-closure risk.

**Fix:** Wrap `loadProfile` in `useCallback` with `[profile?.userId]` as its dep, or move the guard to a `ref` comparison that is not dependent on render-time state.

---

### ~~BUG-02~~ ✅ FIXED — `Invoice.tsx`: polling `while` loop never sees fresh data

**File:** `src/page-components/Invoice.tsx` — lines 88–92  
**Severity:** High

```ts
while (!currentOrder && retries < maxRetries) {
  await new Promise((resolve) => setTimeout(resolve, retryDelay));
  currentOrder = getOrderById(orderId);
  retries++;
}
```

`getOrderById` is captured in a closure at effect-execution time. The `orders` array it reads comes from the context snapshot at that moment. A `while` loop cannot trigger a React re-render, so repeated calls always return the same stale snapshot. If the order has not loaded yet it will always fail after 5 × 200 ms = 1 second, regardless of whether the data actually arrives 300 ms later.

**Fix:** Remove the polling loop. The effect already has an `if (orderId && !ordersLoading)` guard. If the order is not found after loading completes, navigate away — do not spin.

---

### ~~BUG-03~~ ⚠️ N/A — `OrdersContext.updateOrderStatus`: discount recalculation omits `shippingAmount`

**File:** `src/contexts/OrdersContext.tsx` — lines 436–441  
**Severity:** Medium

```ts
const newTotal = subtotal + taxAmount - discountAmount;
```

`updateInvoice` correctly computes `result = subtotal - discount + shipping` before applying tax. `updateOrderStatus` ignores `shippingAmount`. An order with a shipping charge will show an incorrect total after a discount is applied via this path.

**Fix:** Read `order.shippingAmount ?? 0` and include it: `newTotal = subtotal + taxAmount + shippingAmount - discountAmount`.

---

### ~~BUG-04~~ ✅ FIXED — `ManualSaleWizard.handleGoToStep3FromImei`: reads stale `identifierGroups` closure

**File:** `src/components/manual-sale/ManualSaleWizard.tsx` — lines 669–686  
**Severity:** Medium

The handler reads `identifierGroups` to build `identPrices`, but just before it calls `setIdentifierGroups(...)` which enqueues a state update. The new groups are not yet reflected in the closure. Selling-price initialisation for newly-added groups therefore uses the old array, producing missing or stale price defaults in Step 3.

**Fix:** Build `identPrices` from the merged result of existing + new groups before calling `setIdentifierGroups`, or move the price initialisation into a `useEffect` that depends on `identifierGroups`.

---

### ~~BUG-05~~ ✅ FIXED — `NotificationSettingsContext`: Supabase query `.then()` with no `.catch()`

**File:** `src/contexts/NotificationSettingsContext.tsx` — lines 76–96  
**Severity:** Low

The `useEffect` uses `.then(({ data }) => ...)` without a `.catch()`. If the query fails (network error, RLS block), the rejection is silently swallowed and `isLoaded` is never set to `true`, leaving the notification settings panel in a permanent "not loaded" state.

**Fix:** Add `.catch(() => setState((prev) => ({ ...prev, isLoaded: true })))`.

---

### ~~BUG-06~~ ✅ FIXED — `NavigationContext`: `startNavigation` missing from `useMemo` dependency array

**File:** `src/contexts/NavigationContext.tsx` — lines 75–82  
**Severity:** Low

```ts
const value = useMemo<NavigationContextValue>(
  () => ({ isNavigating, startNavigation }),
  [isNavigating], // startNavigation missing
);
```

`startNavigation` is recreated on every render (not `useCallback`-wrapped) but omitted from the `useMemo` dep array. Consumers hold a stale closure to the first render's version. Currently safe because the function body only touches refs, but a latent bug if it is ever changed to reference state.

**Fix:** Wrap `startNavigation` and `stopNavigation` in `useCallback`; include them in the `useMemo` dep array.

---

### ~~BUG-07~~ ✅ FIXED — `InventoryContext.decreaseQuantity`: Supabase update missing `.eq("company_id", companyId)` guard

**File:** `src/contexts/InventoryContext.tsx` — lines 618–619  
**Severity:** Medium

Every other mutating query in this context appends `.eq("company_id", companyId)` as a defence-in-depth guard alongside RLS. `decreaseQuantity` omits it, relying solely on RLS policies. If RLS is misconfigured or a service-role client is used accidentally, a row from another company could be modified.

**Fix:** Add `.eq("company_id", companyId)` to the `.update()` chain.

---

## 2. Unnecessary Re-renders

---

### ~~RENDER-01~~ ✅ FIXED — `UserProfileContext`: inline `value={{...}}` object, no `useMemo`

**File:** `src/contexts/UserProfileContext.tsx` — lines 91–97  
**Severity:** High

```tsx
<UserProfileContext.Provider
  value={{ profile, isLoading: isLoading || authLoading, isAdmin, refreshProfile }}
>
```

No `useMemo` wraps this value. Every render of `UserProfileProvider` creates a new object, forcing all consumers to re-render even when nothing changed. `refreshProfile` is also recreated each render (not `useCallback`-wrapped), so the reference always changes.

**Fix:** Wrap `refreshProfile` in `useCallback`; wrap the value object in `useMemo`.

---

### ~~RENDER-02~~ ✅ FIXED — `RealtimeContext`: inline `value={{...}}` on provider, no `useMemo`

**File:** `src/contexts/RealtimeContext.tsx` — lines 77–84  
**Severity:** Medium

Same pattern — the value object is created inline on every render. React's context equality check compares the object reference, not field values. Every render of the provider triggers all consumers.

**Fix:** Wrap the value in `useMemo`.

---

### ~~RENDER-03~~ ✅ FIXED — `CompanyContext`: value object without `useMemo`

**File:** `src/contexts/CompanyContext.tsx` — lines 35–49  
**Severity:** Medium

```ts
const value: CompanyContextType = { company, membership, companyId: company.id, … };
return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
```

New reference on every render. Since many components destructure `companyId` from this context, every provider re-render triggers all consumers.

**Fix:** Wrap the value in `useMemo`.

---

### ~~RENDER-04~~ ✅ FIXED — `useNotificationsFeed`: `inventoryVersion` dep causes double-computation on realtime events

**File:** `src/hooks/use-notifications-feed.ts` — line 54  
**Severity:** Low

```ts
}, [criticalStockThreshold, inventory, inventoryVersion, lowStockThreshold]);
```

When `inventoryVersion` bumps, TanStack Query also invalidates the inventory cache, which causes `inventory` to change — so the `useMemo` would recalculate anyway. Having `inventoryVersion` as an extra dep causes the memo to run **twice** per realtime event: once with stale `inventory`, once with fresh. This can briefly surface incorrect badge counts.

**Fix:** Remove `inventoryVersion` from the dep array.

---

### ~~RENDER-05~~ ✅ FIXED — `ManualSaleWizard`: `hstRate`, `hstAmount`, `total` computed inline on every render

**File:** `src/components/manual-sale/ManualSaleWizard.tsx` — lines 516–518  
**Severity:** Low

```ts
const hstRate = percentToRate(Math.max(0, parseFloat(hstPercent) || 0));
const hstAmount = subtotal * hstRate;
const total = subtotal + hstAmount;
```

These recalculate on every render regardless of whether `subtotal` or `hstPercent` changed. Given this component's large re-render surface, wrapping in `useMemo` is worthwhile.

---

## 3. Excessive / Redundant DB Calls

---

### ~~DB-01~~ ✅ FIXED — `fetchPaginatedInventory`: debug `console.log` calls left in production

**File:** `src/lib/supabase/queries/inventory.ts` — lines 132 and 163  
**Severity:** Medium

Two `console.log` calls fire on every paginated inventory fetch, flooding the console and leaking schema/query details in production.

**Fix:** Remove both `console.log` calls.

---

### ~~DB-02~~ ✅ FIXED — `Dashboard.tsx`: `staleTime: 0` + `refetchOnMount: "always"` defeats TanStack Query cache

**File:** `src/page-components/Dashboard.tsx` — lines 34–36  
**Severity:** Medium

```ts
staleTime: 0,
refetchOnMount: "always",
```

The app default is `staleTime: 30_000`. This override fires a new RPC on every dashboard mount and every re-render where the query is re-evaluated. The dashboard is the landing page and is mounted frequently. Realtime invalidation already keeps stats fresh.

**Fix:** Set `staleTime: 60_000` and remove `refetchOnMount: "always"`.

---

### ~~DB-03~~ ✅ FIXED — `ManualSaleWizard.handleSubmit`: redundant `invalidateQueries` for keys already invalidated by context methods

**File:** `src/components/manual-sale/ManualSaleWizard.tsx` — lines 1060–1062; `src/contexts/InventoryContext.tsx` — lines 211–216  
**Severity:** Medium

`updateProduct` already invalidates `queryKeys.inventory` and `queryKeys.inventoryAll`. `ManualSaleWizard.handleSubmit` invalidates `queryKeys.inventory` again on the same tick — re-firing the paginated query a second time. The same double-invalidation occurs via `updateManualOrder` in `OrdersContext`.

**Fix:** Remove the redundant invalidations from `ManualSaleWizard.handleSubmit` for keys already handled internally by `createManualOrder` / `decreaseQuantity`.

---

### ~~DB-04~~ ✅ FIXED — `ImeiLookup.tsx`: raw `useEffect` + `fetchFilterOptions` bypasses `useFilterOptions` query cache

**File:** `src/page-components/ImeiLookup.tsx` — lines 88–93  
**Severity:** Low

```ts
useEffect(() => {
  if (!companyId) return;
  fetchFilterOptions(companyId).then(({ storageOptions: opts }) => setStorageOptions(opts));
}, [companyId]);
```

`useFilterOptions()` uses TanStack Query with `staleTime: Infinity`. This raw `useEffect` bypasses that cache and fires a fresh DB query every page mount.

**Fix:** Replace with `const { storageOptions } = useFilterOptions()`.

---

### ~~DB-05~~ ✅ FIXED — `ManualSaleWizard.handleGoToStep2`: N+1 sequential DB queries per selected item

**File:** `src/components/manual-sale/ManualSaleWizard.tsx` — lines 568–578  
**Severity:** Medium

```ts
for (const { item } of selectedItemsList) {
  const { data } = await supabase
    .from("inventory_identifiers")
    .select("id, imei, serial_number, color")
    .eq("inventory_id", item.id)
    .in("status", ["in_stock", "reserved"]);
}
```

One DB round-trip per selected item. For 10 items this is 10 sequential queries before the user can advance to the next step.

**Fix:** Collect all `item.id` values and issue a single query with `.in("inventory_id", itemIds)`, then group results by `inventory_id` in JavaScript.

---

### ~~DB-06~~ ✅ FIXED — `lookupIdentifierForSale`: two sequential queries for serial-number-only devices

**File:** `src/contexts/InventoryContext.tsx` — line 801  
**Severity:** Low

```ts
const row = (await fetchIdent("imei")) ?? (await fetchIdent("serial_number"));
```

Fires two round-trips when the IMEI query returns null (common for serial-number-only devices).

**Fix:** Single query using `.or("imei.eq.${q},serial_number.eq.${q}")`.

---

### ~~DB-07~~ ✅ FIXED — `fetchPaginatedIdentifiers`: 3 sequential DB round-trips per page load

**File:** `src/lib/supabase/queries/inventory.ts` — lines 319–444  
**Severity:** Low

Step 1 resolves `inventory_id`s, step 2 queries identifiers, step 3 fetches inventory details. Steps 2 and 3 could be collapsed into a single join query on `inventory_identifiers` with an embedded `inventory` select.

---

## 4. Memory Leaks / Cleanup

---

### ~~LEAK-01~~ ✅ FIXED — `Settings.tsx`: async promise not cancelled on unmount

**File:** `src/page-components/Settings.tsx` — lines 77–83  
**Severity:** Low

```ts
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    if (data.user?.email) setProfileSettings((s) => ({ ...s, email: data.user!.email! }));
  });
}, []);
```

No cleanup. If the component unmounts before the promise resolves, `setProfileSettings` is called on a dead component.

**Fix:** Add a `let cancelled = false` guard and check it in the `.then()`.

---

### ~~LEAK-02~~ ✅ FIXED — `SuperAdminDashboard.tsx`: fetch with no AbortController, state set after unmount

**File:** `src/page-components/SuperAdminDashboard.tsx` — lines 60–71  
**Severity:** Low

Raw `fetch` in `useEffect` with no `AbortController` and no unmount guard. Quick navigation away causes `setCompanies` / `setStats` to fire on a dead component.

**Fix:** Add an `AbortController`; return a cleanup that calls `abort()`.

---

### ~~LEAK-03~~ ✅ FIXED — `SuperAdminCompanies.tsx`, `SuperAdminAuditLogs.tsx`: same raw-fetch pattern

**Files:** `src/page-components/SuperAdminCompanies.tsx:72`, `src/page-components/SuperAdminAuditLogs.tsx:147,151,155`  
**Severity:** Low

Same issue as LEAK-02. These admin pages bypass TanStack Query entirely, forgoing caching, deduplication, background refresh, error retry, and proper cleanup.

**Fix:** Add `AbortController` cleanup, or migrate to `useQuery`.

---

### ~~LEAK-04~~ ✅ FIXED — `Invoice.tsx`: uncancellable async effect continues after unmount

**File:** `src/page-components/Invoice.tsx` — lines 73–209  
**Severity:** Medium

The `loadData` async function contains `await new Promise(resolve => setTimeout(resolve, 200))` in a while loop with no cleanup function returned from `useEffect`. After unmount, the async function keeps running and calls `setOrder`, `setImeiNumbers`, `setIsLoading`, `form.reset` on a dead component.

**Fix:** See BUG-02. Removing the retry loop eliminates the leak. Add an unmount guard (`let mounted = true; return () => { mounted = false; }`) as a safety net.

---

## 5. UX / Correctness Issues

---

### ~~UX-01~~ ✅ FIXED — `ManualSaleWizard`: form cannot be cleared on submission failure

**File:** `src/components/manual-sale/ManualSaleWizard.tsx` — lines 1064–1070  
**Severity:** Medium

When `createManualOrder` throws, the catch block shows a toast and `finally` resets `isSubmitting`. The wizard stays on step 4 with all form data intact. The button is re-enabled so the user can retry. This is functionally acceptable, but because there is no "clear" option visible to the user, they cannot easily start over without dismissing and reopening the modal.

**Suggestion:** Add a "Start over" / "Clear form" secondary button in the error recovery state.

---

### ~~UX-02~~ ✅ FIXED — `Invoice.tsx`: stale `getOrderById` closure masked by ESLint suppression

**File:** `src/page-components/Invoice.tsx` — line 208  
**Severity:** Low

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [orderId, ordersLoading]);
```

`companyRoute`, `router`, `getOrderById`, `companyId`, and `form` are all used inside the effect but absent from the deps array. The ESLint disable hides the issue. `getOrderById` reads from a stale `orders` context snapshot; if orders update after mount, the effect will not re-run with fresh data.

**Fix:** Use `queryKeys.orderDetail` (a dedicated `useQuery` for the order) instead of relying on the context snapshot in this effect.

---

### ~~UX-03~~ ✅ FIXED — `Orders.tsx`: `queryKey` uses empty string when `selectedOrderId` is null

**File:** `src/page-components/Orders.tsx` — lines 176–181  
**Severity:** Low

```ts
queryKey: queryKeys.orderDetail(selectedOrderId ?? ""),
enabled: selectedOrderId !== null && modalOpen,
```

`enabled: false` prevents the query from firing, but the cache key `["order", "detail", ""]` could theoretically be matched by a stale cache entry.

**Fix:** Use a sentinel key: `queryKey: selectedOrderId ? queryKeys.orderDetail(selectedOrderId) : ["order", "detail", "__none__"]`.

---

### ~~UX-04~~ ✅ FIXED — `Dashboard.tsx`: full skeleton blocks stat cards while waiting for the orders query

**File:** `src/page-components/Dashboard.tsx` — lines 76–80  
**Severity:** Low

```ts
const isDashboardLoading = isLoadingStats || ordersLoading || inventoryLoading;
if (isDashboardLoading) return <AdminDashboardSkeleton />;
```

`ordersLoading` reflects the heavy `fetchAllOrders` query, used only for `monthlyOrderFlow` (a chart). The stat cards come from separate RPC queries that resolve independently. The dashboard is blocked on the slowest query even though stat cards could be shown immediately.

**Fix:** Split the skeleton: show stat cards as soon as `isLoadingStats` is false; show a chart-only skeleton for the section that depends on `orders`.

---

## 6. Architecture Smells

---

### ~~ARCH-01~~ ✅ FIXED — `CompanyContext` value not memoized, inconsistent with other contexts

**File:** `src/contexts/CompanyContext.tsx`  
**Severity:** Medium

`InventoryContext` and `OrdersContext` correctly use `useMemo` for their provider values. `CompanyContext` skips it. Since `companyId` is consumed by many components, every provider re-render (e.g. triggered by a parent context) cascades to all consumers unnecessarily. See also RENDER-03.

---

### ~~ARCH-02~~ ✅ FIXED — Filter/sort/group logic split across `InventoryContext` and `Inventory.tsx`

**Files:** `src/page-components/Inventory.tsx:61–77`, `src/lib/inventory/group-inventory-items.ts`  
**Severity:** Low

`InventoryContext` computes `groupedInventory` via `groupMatchingInventoryItems`. `Inventory.tsx` then applies `filterInventoryItems` and `sortInventoryItems` on top. Both the full unfiltered list and the grouped list are held in memory simultaneously. This is functional but ambiguous — a future developer might add filtering a third time in a component. Document this clearly or consolidate.

---

### ~~ARCH-03~~ ✅ FIXED — `ManualSaleWizard` is a ~2000-line mega-component

**File:** `src/components/manual-sale/ManualSaleWizard.tsx`  
**Severity:** Medium

The component manages 20+ `useState` calls, 4 wizard steps, two fetch flows, batch-lookup, edit-hydration, and a partial-failure submit path. Any state update re-renders the entire 2000-line tree. This is also extremely difficult to unit-test.

**Fix:** Extract each step into its own component (`Step1BrowseItems`, `Step2IdentifierScan`, `Step3Review`, `Step4CustomerDetails`) that receives its slice of state as props. The wizard becomes a thin step-orchestrator.

---

### ~~ARCH-04~~ ✅ FIXED — `OrdersContext.updateInvoice`: total recalculation done on stale in-memory snapshot

**File:** `src/contexts/OrdersContext.tsx` — lines 523–531  
**Severity:** Medium

```ts
const result = subtotal - discountAmount + shippingAmount;
const newTaxAmount = result * taxRate;
const newTotal = Math.max(0, result + newTaxAmount);
```

The computation reads from `getOrderById` which returns the in-memory context snapshot. If that snapshot is stale (realtime update not yet propagated), the recalculated total overwrites the database value with stale numbers. `updateManualOrder` delegates this correctly to an RPC — `updateInvoice` should follow the same pattern.

---

### ~~ARCH-05~~ ✅ FIXED — Super-admin pages bypass TanStack Query entirely

**Files:** `src/page-components/SuperAdminDashboard.tsx`, `SuperAdminCompanies.tsx`, `SuperAdminAuditLogs.tsx`  
**Severity:** Low

These pages use raw `useEffect` + `useState` + `fetch` instead of `useQuery`. They get no caching, no deduplication, no background refresh, no error retry, and no cleanup (see LEAK-02, LEAK-03). Even on low-traffic admin pages this is inconsistent and the source of the memory leaks above.

---

### ~~ARCH-06~~ ✅ PARTIALLY FIXED — Pervasive `as any` casts bypass generated Supabase types

**Files:** `src/lib/supabase/queries/*.ts`, `src/contexts/InventoryContext.tsx`, `src/contexts/OrdersContext.tsx`  
**Severity:** Low (accumulating)

50+ occurrences of `as any` bypass the Supabase generated types for tables not yet in `database.types.ts` (`inventory_identifiers`, `inventory_colors`, `company_settings`, etc.). This eliminates compile-time field-name checking for those queries.

**Fix applied:** Added `inventory_identifiers`, `inventory_colors`, `notification_events`, `company_settings`, and `product_uploads` to `database.types.ts` with full Row/Insert/Update/Relationships definitions. Removed `as any` for read-only selects where properties are not accessed directly. Retained `as any` with `eslint-disable` comments for insert/update operations and property-access selects because Supabase-js v2.89 with PostgREST v12 resolves typed query results as `never` for string-based `.select()` calls — a known type inference limitation that requires `supabase gen types typescript` (CLI login) to fully resolve.

---

## Summary Table

| ID             | Category     | Severity | File(s)                                                     |
| -------------- | ------------ | -------- | ----------------------------------------------------------- |
| BUG-01         | Bug          | High     | `UserProfileContext.tsx:36`                                 |
| BUG-02         | Bug          | High     | `Invoice.tsx:88`                                            |
| BUG-03         | Bug          | Medium   | `OrdersContext.tsx:438`                                     |
| BUG-04         | Bug          | Medium   | `ManualSaleWizard.tsx:669`                                  |
| BUG-05         | Bug          | Low      | `NotificationSettingsContext.tsx:76`                        |
| BUG-06         | Bug          | Low      | `NavigationContext.tsx:75`                                  |
| BUG-07         | Bug          | Medium   | `InventoryContext.tsx:618`                                  |
| RENDER-01      | Re-render    | High     | `UserProfileContext.tsx:91`                                 |
| RENDER-02      | Re-render    | Medium   | `RealtimeContext.tsx:77`                                    |
| RENDER-03      | Re-render    | Medium   | `CompanyContext.tsx:35`                                     |
| RENDER-04      | Re-render    | Low      | `use-notifications-feed.ts:54`                              |
| RENDER-05      | Re-render    | Low      | `ManualSaleWizard.tsx:516`                                  |
| DB-01          | DB Calls     | Medium   | `queries/inventory.ts:132,163`                              |
| DB-02          | DB Calls     | Medium   | `Dashboard.tsx:34`                                          |
| DB-03          | DB Calls     | Medium   | `InventoryContext.tsx:211`, `ManualSaleWizard.tsx:1060`     |
| DB-04          | DB Calls     | Low      | `ImeiLookup.tsx:88`                                         |
| DB-05          | DB Calls     | Medium   | `ManualSaleWizard.tsx:568`                                  |
| DB-06          | DB Calls     | Low      | `InventoryContext.tsx:801`                                  |
| DB-07          | DB Calls     | Low      | `queries/inventory.ts:319`                                  |
| LEAK-01        | Memory Leak  | Low      | `Settings.tsx:77`                                           |
| LEAK-02        | Memory Leak  | Low      | `SuperAdminDashboard.tsx:60`                                |
| LEAK-03        | Memory Leak  | Low      | `SuperAdminCompanies.tsx:72`, `SuperAdminAuditLogs.tsx:147` |
| LEAK-04        | Memory Leak  | Medium   | `Invoice.tsx:73`                                            |
| UX-01          | UX           | Medium   | `ManualSaleWizard.tsx:1064`                                 |
| UX-02          | UX           | Low      | `Invoice.tsx:208`                                           |
| UX-03          | UX           | Low      | `Orders.tsx:176`                                            |
| UX-04          | UX           | Low      | `Dashboard.tsx:76`                                          |
| ARCH-01        | Architecture | Medium   | `CompanyContext.tsx`                                        |
| ARCH-02        | Architecture | Low      | `Inventory.tsx`, `InventoryContext.tsx`                     |
| ARCH-03        | Architecture | Medium   | `ManualSaleWizard.tsx`                                      |
| ARCH-04        | Architecture | Medium   | `OrdersContext.tsx:523`                                     |
| ARCH-05        | Architecture | Low      | Super-admin pages                                           |
| ~~ARCH-06~~ ✅ | Architecture | Low      | All query files + contexts                                  |
