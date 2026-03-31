# Inventory Add and Sale Flow Plan

## Objective

Design and implement a clear, scalable flow for:

- Adding products to inventory as `Single Product` or `Bulk Product`
- Capturing product identity using USB barcode scanner (IMEI/Serial input)
- Recording sale by scanned/searched IMEI/Serial
- Preserving existing behavior while upgrading flow and data model safely

This plan is written to be implementation-ready for frontend, backend, and database changes.

---

## Scope

### In scope

- Add Product mode selector (`Single` vs `Bulk`)
- Single product add flow with review/confirmation step
- Bulk product add flow with shared config + multiple IMEI/Serial scan
- Sheet upload flow update (keep existing process, enforce identifier completeness)
- Device search by IMEI/Serial and mark as sold flow
- Database schema updates and migration strategy
- API/service and UI contract for these flows
- Validation, error handling, and audit trail
- QA/UAT checklist and rollout plan

### Out of scope (for this phase)

- Purchase order lifecycle management
- Advanced supplier invoicing automation
- Warehouse transfer and multi-branch reconciliation
- Customer CRM enhancements

---

## Business Flow Summary

### Add Product Entry

When admin clicks `Add Product`:

1. Show modal/screen: `How do you want to add products?`
2. Options:
   - `Single Product`
   - `Bulk Product`
3. Route to dedicated form state and validation flow based on selection

### Single Product

1. Scan barcode or type IMEI/Serial
2. Fill product details manually
3. Click `Save`
4. Show overview confirmation screen
5. Click `Confirm Add`
6. Persist inventory item and show success

### Bulk Product

1. Fill shared product configuration once
2. Scan multiple IMEI/Serial values (same model/spec/grade/pricing)
3. Validate all scanned rows
4. Show bulk overview (`total`, `valid`, `invalid`)
5. Confirm add
6. Persist all valid items in one operation with row-level result feedback

### Record Sale

1. Search by scan (IMEI/Serial) or manual input
2. Open matched inventory item
3. If status is sellable, click `Mark as Sold`
4. Fill sale details and confirm
5. Update inventory status and write sale + audit logs

### Sheet Upload (Existing Flow Preserved)

1. Keep the current sheet upload journey/UI exactly the same
2. Make `IMEI` and `Serial Number` columns mandatory in upload template and parser contract
3. On upload, validate every row for identifier completeness before import
4. Reject rows with missing identifiers and return row-level errors
5. Import only rows that pass validation (or block all when strict mode is enabled)
6. Show final summary with imported and rejected row counts

---

## Detailed Functional Requirements

## 1) Add Product Mode Selector

### UI Requirements

- Triggered from inventory add action
- Required mode selection before showing form
- Must remember last selected mode per session (optional enhancement)

### Validation

- No default silent mode; admin must explicitly choose

---

## 2) Single Product Add

### Required Inputs

- Identifier:
  - `imei` (for IMEI devices) and/or
  - `serialNumber` (for non-IMEI or dual-support)
- Product details:
  - brand, model, variant/storage, color
  - grade/condition
  - supplier
  - cost price, listing/sale price
  - purchase date (optional)
  - notes (optional)

### Functional Rules

- Scanner input should focus identifier field by default
- Detect duplicate IMEI/Serial before confirmation
- Show review screen before final submit
- Confirmation creates exactly one inventory row

### Overview Screen Content

- Identifier value
- Complete product summary
- Validation warnings (if any)
- Final CTA: `Confirm Add`

---

## 3) Bulk Product Add

### Required Inputs

- Shared product details (same as single flow except identifier)
- Repeating list of scanned/entered identifiers

### Functional Rules

- Fast append scanning experience (scanner acts as keyboard + Enter)
- Each scan adds one row in identifier table
- Prevent duplicate within the same bulk session
- Validate against existing DB duplicates
- Review required before final confirm

### Bulk Review Content

- `Total scanned`
- `Valid rows`
- `Invalid rows`
- Row-wise error reasons:
  - duplicate in session
  - already exists in inventory
  - invalid format
  - empty value

### Submission Strategy

- Recommended default: partial success
  - Insert valid rows
  - Report invalid rows with reasons
- Optional strict mode (future): block all if any row invalid

---

## 4) Record Sale Flow

### Search Entry

- Search bar supports:
  - scanned IMEI/Serial
  - typed IMEI/Serial
- Search action should return exact match item quickly

### Result and Actions

- Show item details + current status
- If status `in_stock` (or sellable), show `Mark as Sold`
- If already sold/non-sellable, show proper disabled state with reason

### Sale Confirmation Data

- sold price
- sold datetime
- reference number (invoice/order) (configurable as required/optional)
- customer note (optional)
- payment mode (optional)

### Sale Finalization

- Update inventory status to sold
- Create sale record linked to inventory item
- Add audit log event

---

## 5) Sheet Upload Flow (Mandatory IMEI/Serial Without UX Change)

### Principle

- Preserve current sheet upload flow and screen sequence.
- Only tighten validation and schema contract to avoid missing device identity data.

### Mandatory Columns

- `IMEI` (required column in file)
- `Serial Number` (required column in file)

Both columns must exist in the uploaded sheet header. Each row must contain at least one non-empty value depending on device type rules. If your operation requires both values per row, enforce both as non-empty.

### Row Validation Rules

- Reject row if header columns are missing
- Reject row if required identifier value is empty
- Trim spaces/newlines before validation
- Reject row if IMEI format invalid
- Reject row if serial format invalid
- Reject row if IMEI/Serial already exists in DB
- Reject row if duplicate appears within same uploaded file

### Import Behavior

- Keep existing upload trigger, progress, and result UI
- Add stricter validation pass before DB insert
- Return row-level error report with:
  - row number
  - column name
  - rejection reason
- Recommended default behavior: partial success with explicit rejected rows list

### Template and Documentation Update

- Update sample upload sheet template to include mandatory `IMEI` and `Serial Number` columns
- Update helper text on upload page:
  - identifiers are required
  - duplicates are rejected
  - format must be valid

---

## Pseudocode Plan (Step-by-step)

```text
ENTRY: Admin clicks "Add Product"
  show modeSelector(single, bulk)
  if no mode selected:
    block continue

SINGLE FLOW:
  capture identifier from scanner/input
  validate identifier format
  query uniqueness(identifier)
  if duplicate:
    show error, block continue

  capture all manual product fields
  validate required fields + pricing rules
  on save:
    build preview payload
    show overview screen
  on confirm:
    insert inventory item
    insert activity log ("inventory_item_created")
    show success

BULK FLOW:
  capture shared product config once
  while scanning identifiers:
    normalize value
    validate format
    check duplicate in current list
    append row with status (valid/invalid + reason)

  on "Review":
    check DB duplicates for pending valid rows
    update row statuses
    show summary (total/valid/invalid)

  on confirm:
    begin transaction
      insert valid inventory rows
      insert activity logs in batch
      save bulk session summary
    commit
    return {insertedCount, failedRows[]}

SALE FLOW:
  capture search value (scan/type)
  fetch inventory by exact identifier
  if not found:
    show "Device not found"
  else if not sellable:
    show blocked state reason
  else:
    open sale form
    validate sale payload
    begin transaction
      update inventory status -> sold
      insert sale record
      insert activity log ("inventory_item_sold")
    commit
    show success
```

---

## Data Model and Database Plan

## Proposed Tables / Columns

> Note: adapt naming to current schema. Keep existing tables if already present; add only missing columns/relations.

### `inventory_items` (core per-device record)

- `id` uuid pk
- `product_id` uuid fk -> product catalog/details
- `imei` text nullable
- `serial_number` text nullable
- `status` text (`in_stock`, `reserved`, `sold`, `returned`, `damaged`)
- `cost_price` numeric
- `sale_price` numeric nullable
- `grade` text
- `supplier_id` uuid nullable
- `created_by` uuid
- `created_at` timestamptz
- `updated_at` timestamptz
- `sold_at` timestamptz nullable

### `sales`

- `id` uuid pk
- `inventory_item_id` uuid fk unique (one active sale per item)
- `sold_price` numeric
- `sold_at` timestamptz
- `sold_by` uuid
- `reference_number` text nullable
- `notes` text nullable
- `payment_mode` text nullable
- `created_at` timestamptz

### `inventory_activity_log`

- `id` uuid pk
- `inventory_item_id` uuid fk
- `event_type` text
- `old_status` text nullable
- `new_status` text nullable
- `metadata` jsonb
- `performed_by` uuid
- `created_at` timestamptz

### `bulk_import_sessions` (recommended)

- `id` uuid pk
- `created_by` uuid
- `shared_payload` jsonb
- `total_rows` int
- `valid_rows` int
- `invalid_rows` int
- `status` text (`completed`, `partial`, `failed`)
- `created_at` timestamptz

## Constraints

- At least one identifier present:
  - check (`imei is not null OR serial_number is not null`)
- Unique IMEI:
  - partial unique index where `imei is not null`
- Unique serial number:
  - partial unique index where `serial_number is not null`
- Status transitions guarded by application logic + optional DB check constraints

## Indexes

- `inventory_items(status)`
- `inventory_items(imei)`
- `inventory_items(serial_number)`
- `inventory_items(created_at desc)`
- `sales(sold_at desc)`

## Migration Strategy

1. Add nullable columns/tables first (backward compatible)
2. Backfill existing data where needed
3. Add indexes
4. Add constraints in safe order
5. Deploy app logic using new schema
6. Enable strict validation after rollout verification

---

## API / Service Contract Plan

## Add Single Product

- `POST /inventory/items`
- Payload:
  - identifier fields
  - product detail fields
- Response:
  - created inventory item
  - validation error details

## Validate Bulk Identifiers

- `POST /inventory/bulk/validate`
- Payload:
  - shared config
  - identifiers[]
- Response:
  - row-level statuses
  - summary counts

## Commit Bulk Add

- `POST /inventory/bulk/commit`
- Payload:
  - session payload / validated rows
- Response:
  - inserted count
  - failed rows[]

## Upload Inventory Sheet (Existing Endpoint/Flow, New Validation Contract)

- Keep current upload endpoint path and frontend flow unchanged
- Enforce required sheet headers and identifier rules on server
- Response should include:
  - `importedCount`
  - `rejectedCount`
  - `rejectedRows[]` with row-level reasons

## Search Item for Sale

- `GET /inventory/search?identifier=<value>`
- Response:
  - matched item + status

## Mark as Sold

- `POST /inventory/items/:id/sell`
- Payload:
  - sold data
- Response:
  - updated item
  - created sale record

---

## Frontend Implementation Plan

## UI Components (reuse existing UI library patterns)

- `AddProductModeSelector`
- `SingleProductForm`
- `SingleProductReview`
- `BulkProductForm`
- `BulkScanTable`
- `BulkReviewSummary`
- `SaleSearchBar`
- `SellConfirmationDialog`

## State Management

- Keep temporary draft state for mode-specific forms
- Keep bulk scanned list in local state/store
- Normalize scanner input (trim/newline cleanup)

## Scanner UX Requirements

- Identifier input auto-focus when entering scan screens
- On scanner Enter:
  - parse value
  - validate
  - append with immediate feedback toast/inline status

---

## Validation Rules

## Identifier

- Trim whitespace
- Reject empty values
- IMEI numeric length validation (project-specific rule)
- Serial minimal length validation (project-specific rule)
- For sheet upload: enforce mandatory `IMEI` and `Serial Number` columns
- For sheet upload rows: enforce identifier completeness per agreed business rule
- Reject duplicate identifiers in the same file and against DB

## Pricing

- cost and sale/listing must be positive
- optional guard: sale >= cost (if business requires)

## Status

- Only `in_stock` items can be sold
- sold item cannot be sold twice

---

## Security and Roles

- Only admin/authorized inventory roles can:
  - add inventory (single/bulk)
  - mark item as sold
- All mutations must write actor id to audit fields/log tables

---

## Edge Cases

- Same identifier scanned twice in bulk session
- Scanner sends trailing newline/control characters
- Search by identifier returns no rows
- Attempt to sell already sold item
- Partial DB failure in bulk commit
- Network retry causing duplicate submission

Mitigation:

- idempotency key for create/sell actions (recommended)
- server-side uniqueness checks always enforced

---

## Testing Plan

## Unit Tests

- identifier normalization/validation helpers
- status transition guards
- bulk summary calculation

## Integration Tests

- single add happy path
- duplicate identifier rejection
- bulk add with mixed valid/invalid rows
- sheet upload with mandatory identifier columns
- sheet upload rejects rows with missing IMEI/Serial
- sheet upload duplicate detection (within file + DB)
- sale mark flow with status checks

## UAT Checklist

- USB scanner can add identifiers quickly
- single add review is accurate
- bulk review counts match scanned list
- sheet upload keeps same UX flow while validating mandatory identifiers
- sheet upload error report clearly shows row-level rejection reasons
- sold action searchable and status updates immediately

---

## Rollout Plan

1. Ship DB migration (safe additive)
2. Ship backend APIs with feature flag
3. Ship frontend mode selector + single flow
4. Enable bulk flow for pilot users
5. Enable sale recording updates
6. Monitor errors, duplicate attempts, and latency
7. Remove flag once stable

---

## Open Questions to Confirm Before Final Build (RESOLVED IN PLAN-0)

1. **Is IMEI mandatory for phones and serial mandatory only for non-phone devices?**
   _Resolution:_ At least one identifier (IMEI or Serial Number) MUST be present for every item. The logic will enforce `imei is not null OR serial_number is not null`.
2. **Should duplicate identifier be blocked forever, or allowed after return/write-off?**
   _Resolution:_ For Phase 1, duplicates are strictly blocked for active inventory.
3. **For bulk commit, do we allow partial success by default?**
   _Resolution:_ Yes, partial success by default. Valid rows commit, invalid rows return an explicit error report.
4. **Is sale reference number mandatory?**
   _Resolution:_ No, optional but recommended.
5. **Should sale reversal (undo sale) be supported in phase 1?**
   _Resolution:_ No, out of scope for Phase 1.
6. **Which existing table names must be reused exactly in current project?**
   _Resolution:_ Reusing `inventory`, `product_uploads`. Sales will either attach to `orders` or a new `sales` table.
7. **For sheet upload rows, should both `IMEI` and `Serial Number` be mandatory per row, or is one of them sufficient based on device type?**
   _Resolution:_ Both `IMEI` and `Serial Number` must exist as headers. Each row must have at least one of them filled.

---

## Final Recommendation

Implement `Single + Bulk + Sale` in phased, additive manner with strict identifier uniqueness, mandatory review before insert, and complete audit logging. This keeps behavior reliable for scanner-driven operations and gives clear operational visibility without risky schema rewrites.
