## API & Data Minimization Review

Goal: identify where the frontend (browser or client components) receives **more data than necessary** from Supabase / API routes, and suggest how to **shrink responses** so:

- Sensitive/internal fields are not visible in the network tab.
- Payloads are smaller and easier to reason about.

This document focuses on **client-side Supabase queries** and **API responses** that are consumed by the UI.

---

## 1. Inventory Data

### 1.1 Public inventory queries use `select("*")`

**Files**

- `src/lib/supabase/queries/inventory.ts`
  - `fetchPaginatedInventory`
  - `fetchAllFilteredInventory`
  - `fetchInventoryByIds`
- `src/contexts/InventoryContext.tsx`
  - `loadInventory`

**Current queries**

- `fetchPaginatedInventory`:

```ts
let query = supabase
  .from("inventory")
  .select("*", { count: "exact" })
  .order("created_at", INVENTORY_SORT_ORDER.created_at)
  .order("id", INVENTORY_SORT_ORDER.id);
```

- `fetchAllFilteredInventory`:

```ts
let query = supabase
  .from("inventory")
  .select("*")
  .order("created_at", INVENTORY_SORT_ORDER.created_at)
  .order("id", INVENTORY_SORT_ORDER.id);
```

- `fetchInventoryByIds`:

```ts
const { data, error } = await supabase
  .from("inventory")
  .select("*")
  .in("id", itemIds)
  .eq("is_active", true)
  .order("created_at", INVENTORY_SORT_ORDER.created_at)
  .order("id", INVENTORY_SORT_ORDER.id);
```

- `InventoryContext.loadInventory`:

```ts
const { data, error } = await supabase
  .from("inventory")
  .select("*")
  .order("created_at", INVENTORY_SORT_ORDER.created_at)
  .order("id", INVENTORY_SORT_ORDER.id);
```

**Why this is more than needed**

- The `inventory` table likely contains:
  - Internal pricing (`purchase_price`, `price_per_unit`, `hst`, `price_change`).
  - Timestamps and possibly other internal fields.
- All of these are **sent to the browser** and visible in the network tab, even when not displayed in the UI.

**Suggested minimal shape**

Align the `SELECT` list with what the UI actually needs (for browsing and carts). A safe starting point for public/regular user views:

```ts
const PUBLIC_INVENTORY_FIELDS = `
  id,
  device_name,
  brand,
  grade,
  storage,
  quantity,
  selling_price,
  is_active,
  last_updated,
  price_change
`;
```

Then update queries, e.g.:

```ts
let query = supabase
  .from("inventory")
  .select(PUBLIC_INVENTORY_FIELDS, { count: "exact" })
  .order("created_at", INVENTORY_SORT_ORDER.created_at)
  .order("id", INVENTORY_SORT_ORDER.id);
```

For `fetchInventoryByIds`, use the same or a slightly extended set if the UI needs more fields for wishlist/cart.

If admins need internal fields (purchase price, margins, etc.), expose them **only** in:

- Admin-only views, or
- Dedicated admin API endpoints guarded by admin role checks.

---

## 2. Orders & Invoices

### 2.1 Orders list queries use `select("*")`

**Files**

- `src/lib/supabase/queries/orders.ts`
  - `fetchPaginatedOrders`
  - `fetchPaginatedUserOrders`
- `src/contexts/OrdersContext.tsx`
  - `loadOrders`
  - `downloadInvoicePDF` (fetches a single order with `select("*")`)

**Current queries**

- `fetchPaginatedOrders`:

```ts
let query = supabase
  .from("orders")
  .select("*", { count: "exact" })
  .order("created_at", { ascending: false });
```

- `fetchPaginatedUserOrders`:

```ts
let query = supabase
  .from("orders")
  .select("*", { count: "exact" })
  .eq("user_id", userId)
  .order("created_at", { ascending: false });
```

- `OrdersContext.loadOrders`:

```ts
const { data, error } = await supabase
  .from("orders")
  .select("*")
  .order("created_at", { ascending: false });
```

- `downloadInvoicePDF` fetch:

```ts
const { data: orderData, error: orderError } = await supabase
  .from("orders")
  .select("*")
  .eq("id", orderId)
  .single();
```

**Why this is more than needed**

- Every order field in the table (including any internal columns added later) is sent to the browser.
- The UI only needs the fields defined in `src/types/order.ts` (`Order` interface), plus any invoice/editing fields.

**Suggested minimal shape**

Define a common `ORDER_FIELDS` string matching `Order`:

```ts
// Example (adjust to match actual column names)
const ORDER_FIELDS = `
  id,
  user_id,
  items,
  subtotal,
  tax_rate,
  tax_amount,
  total_price,
  status,
  created_at,
  updated_at,
  rejection_reason,
  rejection_comment,
  invoice_number,
  invoice_date,
  po_number,
  payment_terms,
  due_date,
  hst_number,
  invoice_notes,
  invoice_terms,
  invoice_confirmed,
  invoice_confirmed_at,
  discount_amount,
  discount_type,
  shipping_amount,
  shipping_address,
  billing_address,
  imei_numbers,
  is_manual_sale,
  manual_customer_name,
  manual_customer_email,
  manual_customer_phone
`;
```

Then:

```ts
let query = supabase
  .from("orders")
  .select(ORDER_FIELDS, { count: "exact" })
  .order("created_at", { ascending: false });
```

For `downloadInvoicePDF`, since this is an admin action and needs all invoice details, `ORDER_FIELDS` (as above) is already sufficient. There’s no need for `*` as long as `ORDER_FIELDS` stays in sync with what the invoice generation actually uses.

---

## 3. User Profiles & Admin User List

### 3.1 `getUserProfile` uses `select("*")`

**File**

- `src/lib/supabase/utils.ts` → `getUserProfile`

**Current query**

```ts
const { data, error } = await supabase
  .from("user_profiles")
  .select("*")
  .eq("user_id", userId)
  .single();
```

**Why this is more than needed**

- The `UserProfile` interface in `src/types/user.ts` defines the fields the app actually needs.
- Any extra columns added to `user_profiles` in the future would silently become visible to the client.

**Suggested minimal shape**

Define a shared `USER_PROFILE_FIELDS` string matching `UserProfile`:

```ts
const USER_PROFILE_FIELDS = `
  id,
  user_id,
  role,
  approval_status,
  approval_status_updated_at,
  first_name,
  last_name,
  phone,
  business_name,
  business_address,
  business_address_components,
  business_state,
  business_city,
  business_country,
  business_years,
  business_website,
  business_email,
  shipping_address,
  shipping_address_components,
  shipping_city,
  shipping_state,
  shipping_country,
  shipping_postal_code,
  billing_address,
  billing_address_components,
  billing_city,
  billing_state,
  billing_country,
  billing_postal_code,
  shipping_same_as_business,
  billing_same_as_business,
  created_at,
  updated_at
`;
```

Then:

```ts
const { data, error } = await supabase
  .from("user_profiles")
  .select(USER_PROFILE_FIELDS)
  .eq("user_id", userId)
  .single();
```

The mapping `dbRowToUserProfile` can remain the same; it simply receives a row with only the needed columns.

---

### 3.2 Admin users table uses `select("*")`

**File**

- `src/lib/supabase/queries/users.ts` → `fetchPaginatedUsers`

**Current query**

```ts
let query = supabase
  .from("user_profiles")
  .select("*", { count: "exact" })
  .order("created_at", { ascending: false });
```

**Why this is more than needed**

- The admin list view likely needs:
  - Basic identity (name, email, phone).
  - Business name/city.
  - Role, approval status, timestamps.
- It does **not** need shipping/billing address components or all internal fields for every row in the table.

**Suggested minimal shape**

Create a narrower field list for the admin list view; for example:

```ts
const ADMIN_USER_LIST_FIELDS = `
  id,
  user_id,
  role,
  approval_status,
  approval_status_updated_at,
  first_name,
  last_name,
  phone,
  business_name,
  business_email,
  business_city,
  created_at,
  updated_at
`;
```

Then:

```ts
let query = supabase
  .from("user_profiles")
  .select(ADMIN_USER_LIST_FIELDS, { count: "exact" })
  .order("created_at", { ascending: false });
```

If detailed address information is needed, load it lazily on a per-user detail view instead of for every row.

---

## 4. Company Settings

### 4.1 `company_settings` uses `select("*")`

**File**

- `src/page-components/Settings.tsx` → `loadCompanySettings`

**Current query**

```ts
const { data, error } = await supabase
  .from("company_settings")
  .select("*")
  .single();
```

**Why this is more than needed**

- The component only uses:
  - `id`
  - `company_name`
  - `company_address`
  - `hst_number`
  - `logo_url`
- Any other columns on `company_settings` (e.g. internal flags, audit details) are still sent to the client.

**Suggested minimal shape**

```ts
const { data, error } = await supabase
  .from("company_settings")
  .select("id, company_name, company_address, hst_number, logo_url")
  .single();
```

This keeps the network payload minimal and clearly documents which fields power the Settings UI.

---

## 5. Upload History / Logs

### 5.1 `product_uploads` uses `select("*")`

**File**

- `src/contexts/InventoryContext.tsx` → `getUploadHistory`

**Current query**

```ts
const { data, error } = await (supabase.from("product_uploads") as any)
  .select("*")
  .order("created_at", { ascending: false });
```

**Why this is more than needed**

- Log tables often contain:
  - Detailed error messages.
  - Internal identifiers.
  - Debugging data not meant for general display.
- Even if RLS restricts this to admins, minimizing what’s sent to the browser still reduces accidental exposure and payload size.

**Suggested minimal shape**

```ts
const { data, error } = await (supabase.from("product_uploads") as any)
  .select(
    "id, uploaded_by, file_name, total_products, successful_inserts, failed_inserts, upload_status, error_message, created_at, updated_at"
  )
  .order("created_at", { ascending: false });
```

If the UI does not display `error_message`, consider omitting it here and fetching only when the user opens a detailed log view.

---

## 6. Stats Queries

**File**

- `src/lib/supabase/queries/stats.ts`

**Notes**

- `fetchInventoryStats` already selects **only** `id, quantity, selling_price`.
- `fetchOrderStats` uses `.select("*", { count: "exact", head: true })` — because `head: true`, no row data is actually returned, only counts.

**Conclusion**

- These queries already follow good data-minimization practices and do **not** leak extra row contents.

---

## 7. General Guidelines for Future APIs

1. **Never use `select("*")` in browser or client components.**
   - Always specify the exact columns needed.
   - Define reusable field lists (e.g. `ORDER_FIELDS`, `USER_PROFILE_FIELDS`) next to their types.

2. **Map DB rows to view models early.**
   - Use mapper functions (`dbRowToOrder`, `dbRowToUserProfile`, `dbRowToInventoryItem`) that accept **minimal** rows and return only what the UI should see.

3. **Prefer lazy detail loading over “load everything”.**
   - For heavy or sensitive fields (full addresses, logs, comments), load them only when the user opens a detail panel, not on every list view.

4. **Keep admin vs. public shapes separate.**
   - Public / normal-user queries should never include internal financials or operational metadata.
   - Admin views can use broader shapes but should still avoid `*` to document what’s actually needed.

By applying the changes above, the app will:

- Reduce the amount of sensitive or internal data visible in browser tools.
- Make RLS and permissions easier to reason about.
- Improve performance by trimming unused columns from responses.

