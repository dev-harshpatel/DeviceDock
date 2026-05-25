# Optimization Plan: Supabase Client Leakage Elimination & Absolute Isolation

During an independent architectural audit of the DeviceDock codebase, we discovered a significant "leakage" of raw Supabase data transactions bypassing the centralized isolation layer. While earlier phases established a robust query layer under `src/lib/supabase/queries/`, multiple core client-side hooks and page-level components still import the direct `supabase` client and write raw `supabase.from("...")` transactions.

This plan details the systematic extraction and migration of all remaining raw database operations into the centralized query layer, achieving 100% data tier isolation.

---

## 🔍 The Leakage Audit (Current State)

We identified **16 raw query transactions** across **8 files** that still directly access the database, violating the central architecture contract:

1. **`use-manual-sale-wizard.ts`**
   - Direct query to `inventory_identifiers` on lines 68-71 (to fetch display labels for IMEI/serials).
   - Direct query to `inventory_identifiers` on lines 501-505 (to fetch available units with statuses `in_stock` and `reserved`).
2. **`use-product-management.ts`**
   - Direct query to `inventory_colors` on line 118 (to aggregate color counts).
   - Direct delete to `inventory_colors` on line 231 (to reset colors).
   - Direct upsert to `inventory_colors` on line 245 (to consolidate color rows).
   - Direct select count head on `orders` on line 324 (to check order references).
   - Direct delete on `inventory` on line 349 (to delete raw product rows).
3. **`use-order-details.ts`**
   - Direct query to `inventory_identifiers` on line 100 (to fetch assigned colors for items).
4. **`use-bulk-products-form.ts`**
   - Direct query to `inventory_colors` on line 247.
5. **`use-identifier-map.ts`**
   - Direct query to `inventory_identifiers` on line 19 (to build in-memory IMEI map).
6. **`use-invoice-management.ts`**
   - Direct query to `company_settings` on line 101.
7. **`AdminLogin.tsx` & `SuperAdminLogin.tsx`**
   - Direct login queries on `company_users` and `platform_super_admins` tables during login validation checks.

---

## 🛠️ Proposed Optimization & Refactoring

We will systematically extract these query blocks into domain-focused helper functions inside `src/lib/supabase/queries/` and refactor the hooks/pages.

### Phase 1: Query Layer Expansion (`src/lib/supabase/queries/`)

We will add the following reusable query and mutation functions to centralize schemas:

#### `queries/inventory.ts`

- **`fetchIdentifierLabelsQuery(ids: string[]): Promise<Array<{ id, imei, serial_number, color }>>`**
  - Isolates IMEI/serial lookup label fetching (used in Manual Sale wizard).
- **`fetchAvailableIdentifiersQuery(itemIds: string[]): Promise<any[]>`**
  - Fetches list of available IMEI units in stock/reserved.
- **`fetchInventoryColorsByProductIdsQuery(ids: string[]): Promise<any[]>`**
  - Consolidates color retrieval for product management list.
- **`deleteInventoryColorsByProductIdsQuery(ids: string[]): Promise<void>`**
  - Clears color rows from inventory rows.
- **`checkOrderReferencesCountQuery(companyId: string, productId: string): Promise<number>`**
  - Queries `orders` table to check how many active sales reference this product ID.
- **`deleteInventoryItemsQuery(ids: string[], companyId: string): Promise<void>`**
  - Deletes raw product records from the database safely.

#### `queries/settings.ts`

- **`fetchCompanySettingsForInvoiceQuery(companyId: string): Promise<any>`**
  - Encapsulates fetching invoice header meta.

---

### Phase 2: Client Hooks Refactoring

We will systematically update the following custom hooks to remove direct `supabase` client imports and route operations through `@/lib/supabase/queries`:

1. **`use-manual-sale-wizard.ts`**: Replace inline `supabase.from("inventory_identifiers")` calls with `fetchIdentifierLabelsQuery` and `fetchAvailableIdentifiersQuery`.
2. **`use-product-management.ts`**: Replace inline `supabase.from(...)` queries with the new `queries/inventory.ts` helpers.
3. **`use-order-details.ts`**: Route IMEI color fetches through `fetchInventoryColorsQuery`.
4. **`use-bulk-products-form.ts`** & **`use-identifier-map.ts`**: Unify under central isolation methods.
5. **`use-invoice-management.ts`**: Leverage `fetchCompanySettingsForInvoiceQuery`.

---

## 📂 Verification & Safety Plan

To ensure zero impact on user functionality, we will perform rigorous automated build audits:

- **TypeScript build audit**: Run `npx tsc --noEmit` to verify all imports resolve cleanly with no syntax errors.
- **ESLint strict analysis**: Run `npx eslint --max-warnings=0` across modified files to achieve warning-free compliance.
- **Verification of workflows**: Test critical operational paths:
  1. Manual Sale Wizard step checkout.
  2. Single IMEI device deletes and color resets.
  3. Bulk products uploads.
  4. Invoice generations.
