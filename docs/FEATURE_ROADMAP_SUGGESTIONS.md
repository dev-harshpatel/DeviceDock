# DeviceDock — Feature Roadmap & Monetization Suggestions

> **Purpose:** Structured feature suggestions for both the Super Admin (platform operator) and Admin (company/tenant) sides. These are organized by priority and monetization potential.
>
> **Context:** DeviceDock is a multi-tenant B2B SaaS inventory and order management platform for mobile device suppliers. Companies are tenants; their employees are users. The super admin is the platform operator (you). There is currently no subscription or billing system — but the feature-flag infrastructure is already in place.

---

## Table of Contents

1. [Super Admin Features](#1-super-admin-features)
2. [Admin (Company Owner) Features](#2-admin-company-owner-features)
3. [Monetization Model Suggestions](#3-monetization-model-suggestions)
4. [Implementation Priority Matrix](#4-implementation-priority-matrix)

---

## 1. Super Admin Features

These are platform-level capabilities visible only to you as the operator. The goal is full visibility, control, and the ability to operate and grow the platform confidently.

---

### 1.1 Subscription & Plan Management

**What:** A complete UI for managing subscription tiers (Free, Starter, Pro, Enterprise). Assign plans to companies, adjust limits, view billing status, and manually override plan access.

**Why it helps you:**

- Central control over what each company can and cannot access
- Ability to grant/revoke premium features on a per-company basis
- Foundation for all future monetization

**Sub-features:**

- Create/edit plan tiers: define limits (max users, max inventory items, max orders/month, storage)
- Assign a plan to any company from the super admin dashboard
- Override any company's plan manually (e.g., give a trial extension)
- View all companies by plan tier with expiry dates
- Grace period management (company downgraded but data preserved for N days)

**Schema needed:** `plans`, `company_subscriptions`, `subscription_events`

---

### 1.2 Platform Revenue Dashboard

**What:** A financial overview of the platform itself — MRR, ARR, churn rate, plan distribution, new signups vs cancellations.

**Why it helps you:**

- Track business health at a glance
- Identify which plan tier drives the most revenue
- Spot churn signals before companies leave

**Sub-features:**

- Monthly Recurring Revenue (MRR) chart with trends
- Breakdown by plan tier (how many companies per tier)
- New vs churned companies per month
- Lifetime value estimate per company
- Trial-to-paid conversion rate tracking

---

### 1.3 Company Lifecycle Management

**What:** Expand the current company detail page with full lifecycle controls — suspend, reactivate, downgrade, delete, and export a company's data.

**Why it helps you:**

- Handle support requests faster without touching the database directly
- Enforce payment failures gracefully (suspend, not delete)
- GDPR/legal compliance: data export and deletion

**Sub-features:**

- Suspend company (blocks all logins, preserves data)
- Reactivate suspended company
- Soft-delete company with 30-day data retention before permanent removal
- Export all company data as JSON/CSV (compliance use case)
- View company's full activity log (orders, inventory changes, logins)
- Add internal notes to a company record (e.g., "on-hold: awaiting payment")

---

### 1.4 Platform-Wide Usage Analytics

**What:** Aggregate usage data across all tenants — total orders processed, inventory items managed, IMEI lookups performed, bulk uploads, active users.

**Why it helps you:**

- Understand what features are actually being used
- Identify power users (companies that may need Enterprise tier)
- Find companies that signed up but barely use the platform (re-engagement targets)

**Sub-features:**

- Per-company usage breakdown: orders/month, inventory items, user count, last login
- Platform totals: total orders, total items tracked, total IMEI scans
- Feature adoption heatmap: which features each company uses most
- Dormant company detection (no activity in 30+ days)
- Peak usage time analysis (useful for infra scaling decisions)

---

### 1.5 Announcement & Communication System

**What:** Ability to push announcements or notifications to all companies or specific ones — maintenance windows, new feature announcements, plan expiry warnings.

**Why it helps you:**

- Communicate platform changes without emailing individually
- Drive feature adoption by announcing new capabilities in-app
- Warn companies about upcoming plan changes or expirations

**Sub-features:**

- Create a platform-wide banner announcement (shown in all company dashboards)
- Target announcement to specific plan tiers or specific companies
- Schedule announcements (e.g., "show this banner on [date]")
- In-app notification feed per company for operator messages
- Email broadcast to all company owners (bulk email via Resend/SendGrid)

---

### 1.6 Feature Flag Control Center

**What:** A super admin UI to toggle features on/off per company without code deployments. Extend the existing `feature_catalog` system.

**Why it helps you:**

- Beta-test new features with specific companies before full rollout
- Instantly grant or revoke features for individual tenants
- Enable "early access" programs for engaged customers

**Sub-features:**

- View all features in the catalog with their current status
- Toggle any feature for any company with a single switch
- Batch enable a feature for all companies on a specific plan tier
- Set feature expiry dates (e.g., trial access to a premium feature for 14 days)
- Track which companies have non-default feature configurations

---

### 1.7 Onboarding Pipeline View

**What:** A funnel view showing companies at each stage of signup/onboarding — registered, email confirmed, first product added, first order placed.

**Why it helps you:**

- Identify where companies drop off during onboarding
- Target incomplete signups for manual follow-up
- Measure time-to-value (how long it takes a new company to complete their first order)

**Sub-features:**

- Funnel: registered → confirmed → first login → first product → first order
- List of companies stuck at each stage with time-since-stage
- One-click re-send confirmation email to incomplete signups
- Mark a company as "needs outreach" for sales follow-up

---

### 1.8 Audit Log Improvements

**What:** Enhance the existing `platform_audit_logs` with filtering, search, and export.

**Why it helps you:**

- Debug issues for specific companies faster
- Provide audit trails for compliance or legal requests
- Monitor for suspicious behavior (bulk deletes, repeated failed logins)

**Sub-features:**

- Filter by company, user, action type, date range
- Search by resource ID (e.g., find all actions on a specific order)
- Export filtered logs as CSV
- Flag suspicious patterns (e.g., more than 100 deletes in 1 hour)
- Retention policy settings (auto-purge logs older than X months)

---

### 1.9 Support Ticket Lite

**What:** A lightweight in-app support inbox where company owners can raise issues that appear in the super admin dashboard.

**Why it helps you:**

- Centralize support communication inside the app (vs email chaos)
- Build a history of issues per company
- Reduce time spent on back-and-forth by having full context attached (company, user, relevant page)

**Sub-features:**

- Company owners open a ticket from a "Help & Support" section
- Ticket includes auto-attached context: company, user role, current page, browser
- Super admin sees all open tickets with severity tags
- Reply directly from the super admin panel
- Mark tickets as resolved with optional resolution note

---

## 2. Admin (Company Owner) Features

These are features visible to company owners and managers within their own tenant. The goal is to give admins powerful tools that make DeviceDock indispensable to their daily operations — and make them want to upgrade their plan.

---

### 2.1 Advanced Analytics & Business Intelligence

**What:** A richer analytics module beyond the current basic reports. Give company owners real revenue intelligence and inventory insights.

**Why it attracts admins:**

- Decision-making data that replaces Excel spreadsheets
- Helps them understand what's selling, what's sitting, and what to reorder

**Sub-features:**

- **Revenue trends:** Daily/weekly/monthly revenue with period-over-period comparison
- **Best-selling models:** Ranked by units sold, revenue, and margin
- **Inventory velocity:** Average days-to-sell per model/grade
- **Dead stock report:** Items in stock longer than 30/60/90 days
- **Margin analysis:** Selling price vs cost price per SKU
- **Top customers:** Ranked buyers by order volume and revenue
- **Demand forecasting:** Extend the existing forecast model with confidence intervals and reorder suggestions
- **Grade performance:** Compare sales and margin by grade (A, B, C)

**Plan tier:** Pro and above

---

### 2.2 Customer (Buyer) Management

**What:** A full CRM-lite for managing the business buyers (customers) who place orders. Currently buyers are just names on orders — give them a proper profile.

**Why it attracts admins:**

- Admins can track buyer relationships, credit limits, and outstanding balances
- Replaces the need for a separate spreadsheet to track customers

**Sub-features:**

- Customer profile: name, business name, address, contact info, HST number
- Purchase history per customer (all orders, total spend, last order date)
- Credit limit per customer (block orders that exceed the limit)
- Outstanding balance tracker (invoiced but unpaid)
- Customer notes (internal comments)
- Customer approval workflow already exists — extend it with these details

---

### 2.3 Low-Stock Reorder & Purchase Orders

**What:** When inventory hits the low-stock threshold, allow admins to create a **purchase order** (PO) to their own suppliers — tracking what was ordered, from whom, at what cost, and when it arrived.

**Why it attracts admins:**

- Closes the loop on the full inventory cycle: buy → stock → sell
- Reduces the need for external procurement tracking (Excel, email)

**Sub-features:**

- Create a PO against a supplier (name, contact, lead time)
- Line items: model, grade, quantity, cost per unit
- PO status: draft → sent → partially received → fully received
- On receive: automatically add inventory items (prompt for IMEI/serial entry)
- PO history linked to resulting inventory items
- Supplier management: maintain a list of approved suppliers

---

### 2.4 Multi-Warehouse / Location Support

**What:** Track inventory across multiple physical locations (stores, warehouses, offices) and know exactly where each unit is.

**Why it attracts admins:**

- Companies with multiple locations currently have no way to separate stock
- Enables smarter fulfillment: allocate units from the nearest location

**Sub-features:**

- Define locations (name, address, type: warehouse/store/transit)
- Assign inventory items to a location
- Transfer items between locations with a transfer record
- Location-level stock counts and low-stock alerts
- Orders fulfilled from a specific location
- Location filter on inventory and reports pages

**Plan tier:** Pro and above

---

### 2.5 Automated Alerts & Notifications

**What:** Expand the current alerts system beyond stock thresholds. Give admins configurable triggers for any significant business event.

**Why it attracts admins:**

- Proactive awareness without logging in constantly
- Catches issues before they become problems (unsold stock, overdue invoices)

**Sub-features:**

- **Order events:** Alert when an order is placed, approved, or overdue
- **Inventory events:** Alert when an item is marked damaged or returned
- **Finance events:** Alert when a large order exceeds $X value
- **Dead stock alert:** Items unsold after N days trigger a markdown suggestion
- **Overstocked alert:** Single SKU exceeds X units in stock
- **Delivery channels:** In-app notification, email, and (Pro) Slack/webhook
- **Alert schedule:** Choose digest (daily summary) vs real-time

---

### 2.6 Invoice Customization & Branding

**What:** Let admins fully customize the invoices sent to their buyers — logo, colors, footer text, payment terms, bank details, custom fields.

**Why it attracts admins:**

- Professional invoices = stronger brand image with their customers
- Required for many B2B businesses (company letterhead, tax registration numbers)

**Sub-features:**

- Upload logo (already exists), set primary color
- Add company tagline, website, email, phone to invoice header
- Configurable payment terms (Net 7, Net 15, Net 30, Due on Receipt)
- Add bank/payment instructions to invoice footer
- Custom fields (e.g., "PO Reference", "Contract Number")
- Invoice number prefix and sequence reset
- PDF download with custom design applied
- Preview invoice before sending

---

### 2.7 Role & Permission Enhancements

**What:** More granular role control and a better UI for managing team permissions.

**Why it attracts admins:**

- Larger companies need more granular control (a sales rep shouldn't see cost prices)
- Currently only the owner can manage users — add a co-owner concept

**Sub-features:**

- **Co-owner role:** A second user with full admin rights (useful for business partners)
- **Custom roles:** Admin can create named roles with specific permission sets
- **Permission groups:** Instead of per-user overrides, assign permissions to a named group
- **Sensitive data masking:** Option to hide cost price / purchase price from non-owner roles
- **Time-limited access:** Invite an external user with auto-expiry (e.g., contractor for 30 days)
- **Login activity:** See last login time per team member

---

### 2.8 Bulk Operations & Productivity Tools

**What:** Enable admins and inventory managers to perform bulk actions that currently require one-by-one operations.

**Why it attracts admins:**

- Saves significant time for companies with large inventory catalogs
- Reduces human error from repetitive single-item edits

**Sub-features:**

- Bulk price update: select multiple SKUs, apply % increase/decrease
- Bulk status change: mark multiple identifiers as damaged/returned at once
- Bulk assign to location (see 2.4)
- Bulk export: selected orders or inventory items to CSV/Excel
- Bulk customer assignment: assign multiple orders to a buyer
- Search and replace: find all items of model X grade B and update grade to C

---

### 2.9 Mobile App / Progressive Web App (PWA)

**What:** A mobile-optimized experience (or installable PWA) for inventory scanning and quick order checks on the go.

**Why it attracts admins:**

- Warehouse staff and sales reps need mobile access
- IMEI scanning is already in the app — a PWA could use the phone camera natively

**Sub-features:**

- PWA manifest for install-to-home-screen on Android/iOS
- Offline IMEI lookup cache (check a device status without internet)
- Camera-based barcode/IMEI scan (replace manual typing on mobile)
- Quick order status view optimized for small screens
- Push notifications for alerts (Pro tier)

---

### 2.10 API Access & Webhooks

**What:** Provide a REST API and configurable webhooks so companies can integrate DeviceDock with their own systems (accounting software, CRMs, custom dashboards).

**Why it attracts admins:**

- Power users want to connect DeviceDock to QuickBooks, Shopify, or internal tools
- Webhooks let companies build their own automations without waiting for features

**Sub-features:**

- API key management (create/revoke keys)
- API endpoints: inventory, orders, customers, reports
- Webhook subscriptions: choose events (order.created, inventory.low_stock, etc.)
- Webhook delivery log with retry logic
- API usage dashboard (calls/day, rate limit status)
- API documentation page (auto-generated from OpenAPI spec)

**Plan tier:** Pro and Enterprise only

---

### 2.11 Data Import / Export Improvements

**What:** Extend the current Excel import with richer export options and a two-way sync capability.

**Why it attracts admins:**

- Companies need to extract their data for accounting, audits, and backups
- A better import UX (with error preview) reduces frustration during onboarding

**Sub-features:**

- Export orders to CSV/Excel with customizable column selection
- Export inventory with full history (purchase date, sale date, margin per unit)
- Export HST report as CRA-ready format
- Import customers/buyers from CSV
- Scheduled exports: auto-send a CSV report by email every Monday
- Import preview: show a diff of what will change before confirming bulk import

---

### 2.12 Damage & Return Tracking

**What:** A dedicated workflow for handling returned and damaged devices — with condition tracking, refund recording, and insurance/write-off support.

**Why it attracts admins:**

- Returns and damages are a real operational pain point in mobile device trade
- Currently devices can be marked damaged/returned but there is no structured workflow

**Sub-features:**

- Return request form: buyer initiates a return, admin reviews
- Return status: requested → approved → received → restocked / written off
- Condition on return: graded (A/B/C/damaged) with notes and photos
- Restock flow: if returned unit is resalable, restore to inventory with new grade
- Write-off log: damaged units permanently removed with reason (dropped, water damage, theft)
- Insurance claim log: attach a claim reference to a write-off event
- Return analytics: top returning customers, top returned models

---

## 3. Monetization Model Suggestions

Based on the platform's current capabilities and the features suggested above, here is a recommended tiered pricing structure:

---

### Plan Structure

| Feature                     | Free / Trial | Starter | Pro       | Enterprise |
| --------------------------- | ------------ | ------- | --------- | ---------- |
| Duration                    | 14 days      | Monthly | Monthly   | Annual     |
| Companies                   | 1            | 1       | 1         | Custom     |
| Users                       | 3            | 5       | 20        | Unlimited  |
| Inventory items             | 100          | 500     | Unlimited | Unlimited  |
| Orders / month              | 20           | 100     | Unlimited | Unlimited  |
| IMEI tracking               | Yes          | Yes     | Yes       | Yes        |
| HST Reconciliation          | Yes          | Yes     | Yes       | Yes        |
| Basic Reports               | Yes          | Yes     | Yes       | Yes        |
| Advanced Analytics (2.1)    | —            | —       | Yes       | Yes        |
| Customer Management (2.2)   | —            | —       | Yes       | Yes        |
| Purchase Orders (2.3)       | —            | —       | Yes       | Yes        |
| Multi-Location (2.4)        | —            | —       | Yes       | Yes        |
| Invoice Customization (2.6) | —            | Yes     | Yes       | Yes        |
| Custom Roles (2.7)          | —            | —       | Yes       | Yes        |
| Bulk Operations (2.8)       | —            | Yes     | Yes       | Yes        |
| API Access (2.10)           | —            | —       | Yes       | Yes        |
| Webhooks (2.10)             | —            | —       | Yes       | Yes        |
| Scheduled Exports (2.11)    | —            | —       | Yes       | Yes        |
| Return Tracking (2.12)      | —            | Yes     | Yes       | Yes        |
| Priority Support            | —            | —       | —         | Yes        |
| Dedicated Onboarding        | —            | —       | —         | Yes        |
| SLA Guarantee               | —            | —       | —         | Yes        |

### Suggested Pricing (CAD)

| Plan       | Monthly | Annual (save 20%) |
| ---------- | ------- | ----------------- |
| Starter    | $49/mo  | $470/yr           |
| Pro        | $129/mo | $1,238/yr         |
| Enterprise | Custom  | Custom            |

---

### Add-On Revenue Opportunities

| Add-On                 | Price           | Notes                              |
| ---------------------- | --------------- | ---------------------------------- |
| Extra users            | $8/user/mo      | Above plan limit                   |
| Extra locations        | $15/location/mo | Above plan limit (Pro)             |
| API overage            | $0.01/call      | Above 10K/mo (Pro)                 |
| White-label branding   | $50/mo          | Remove DeviceDock branding         |
| Dedicated instance     | $200+/mo        | Enterprise only, isolated DB       |
| Data migration service | One-time fee    | Onboarding from Excel/other system |
| Training & setup       | One-time fee    | Guided onboarding session          |

---

## 4. Implementation Priority Matrix

Suggested order of implementation based on effort, impact, and monetization value:

### Phase 1 — Foundation (Build before launching paid plans)

| #   | Feature                                  | Side        | Effort | Impact   |
| --- | ---------------------------------------- | ----------- | ------ | -------- |
| 1   | Subscription & Plan Management (1.1)     | Super Admin | High   | Critical |
| 2   | Invoice Customization (2.6)              | Admin       | Medium | High     |
| 3   | Advanced Analytics — basic version (2.1) | Admin       | Medium | High     |
| 4   | Feature Flag Control Center (1.6)        | Super Admin | Medium | High     |
| 5   | Platform Revenue Dashboard (1.2)         | Super Admin | Medium | High     |

### Phase 2 — Growth (Add after first paying customers)

| #   | Feature                                | Side        | Effort | Impact |
| --- | -------------------------------------- | ----------- | ------ | ------ |
| 6   | Customer Management (2.2)              | Admin       | Medium | High   |
| 7   | Automated Alerts & Notifications (2.5) | Admin       | Medium | Medium |
| 8   | Role & Permission Enhancements (2.7)   | Admin       | Medium | Medium |
| 9   | Company Lifecycle Management (1.3)     | Super Admin | Medium | High   |
| 10  | Onboarding Pipeline View (1.7)         | Super Admin | Low    | High   |

### Phase 3 — Retention & Expansion (Lock in companies, expand ARPU)

| #   | Feature                         | Side  | Effort | Impact |
| --- | ------------------------------- | ----- | ------ | ------ |
| 11  | API Access & Webhooks (2.10)    | Admin | High   | High   |
| 12  | Purchase Orders (2.3)           | Admin | High   | High   |
| 13  | Multi-Location Support (2.4)    | Admin | High   | Medium |
| 14  | Damage & Return Tracking (2.12) | Admin | Medium | High   |
| 15  | Bulk Operations (2.8)           | Admin | Medium | Medium |

### Phase 4 — Platform Maturity

| #   | Feature                                | Side        | Effort | Impact |
| --- | -------------------------------------- | ----------- | ------ | ------ |
| 16  | Support Ticket Lite (1.9)              | Super Admin | Medium | Medium |
| 17  | PWA / Mobile (2.9)                     | Admin       | High   | Medium |
| 18  | Announcement System (1.5)              | Super Admin | Low    | Medium |
| 19  | Data Import/Export Improvements (2.11) | Admin       | Medium | Medium |
| 20  | Platform-Wide Usage Analytics (1.4)    | Super Admin | Medium | High   |

---

_Document created: 2026-04-02_
_Author: Feature planning session — DeviceDock SaaS roadmap_
