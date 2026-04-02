# DeviceDock — Pricing Model

> **Purpose:** Research-backed pricing strategy for selling DeviceDock to B2B mobile device companies (admins/company owners).
>
> **Research basis:** Competitor pricing analysis (Cin7, inFlow, Zoho, Sortly, Unleashed, Katana, ERP Gold), SaaS pricing psychology literature, Canadian market specifics (GST/HST on SaaS, CAD pricing benchmarks). All prices in **CAD**.

---

## Table of Contents

1. [Market Positioning](#1-market-positioning)
2. [Pricing Model Decision](#2-pricing-model-decision)
3. [Tier Structure & Pricing](#3-tier-structure--pricing)
4. [Feature Gates Per Tier](#4-feature-gates-per-tier)
5. [Add-Ons](#5-add-ons)
6. [Free Trial Strategy](#6-free-trial-strategy)
7. [Annual vs. Monthly Strategy](#7-annual-vs-monthly-strategy)
8. [Canadian Tax & Compliance](#8-canadian-tax--compliance)
9. [Competitor Benchmark Reference](#9-competitor-benchmark-reference)
10. [Pricing Page Psychology](#10-pricing-page-psychology)
11. [Implementation Notes](#11-implementation-notes)

---

## 1. Market Positioning

### Who we are selling to

**Primary buyer:** Owner or operations manager of a B2B mobile device supplier — a company that buys used/refurbished phones in bulk, grades them (A/B/C), and resells to other businesses. They manage:

- Inventory of hundreds to thousands of units with IMEI/serial tracking
- Orders from approved business buyers with invoicing
- A small team (2–20 employees) with different access levels
- Canadian tax compliance (HST/GST reconciliation)

**Company size:** 2–50 employees. Most are 2–10 people at the point of first signup.

**Budget posture:** Canadian SMB. They know what they pay for QuickBooks, their phone plan, their shipping software. They are cost-conscious but will pay for something that genuinely replaces Excel and saves hours per week. They are not enterprise — they do not have IT departments or procurement processes.

---

### How we win against competitors

| Competitor           | Their Weakness                                                                                   | DeviceDock's Advantage                                                |
| -------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **Cin7 / DEAR**      | Starts at ~$490 CAD/mo, built for manufacturing — overkill and overpriced for mobile device SMBs | Purpose-built for device suppliers at a fraction of the cost          |
| **inFlow Inventory** | $499 USD mandatory onboarding fee, USD pricing, no IMEI-first design                             | Self-serve, no setup fee, native IMEI/serial tracking as core feature |
| **Zoho Inventory**   | Only 2 users on plans up to $111 CAD/mo; ecosystem lock-in to other Zoho products                | 5 users on mid-tier, no ecosystem dependency, Canadian tax-native     |
| **Sortly**           | No order management, no invoicing, no HST — it is an asset tracker not a B2B ops tool            | Full order-to-invoice workflow included from day one                  |
| **ERP Gold**         | No public pricing, no self-serve, requires sales contact                                         | Transparent CAD pricing, instant self-serve signup                    |
| **Unleashed**        | Starts at ~$530 CAD/mo, targets larger operations                                                | Entry tier at $99 CAD/mo makes it accessible to early-stage suppliers |

**Three core positioning statements for the pricing page:**

> "Built for Canadian mobile device suppliers — not adapted from a general inventory tool."

> "IMEI and serial tracking is not a bolt-on. It is the foundation."

> "Transparent CAD pricing. No setup fees. No surprises."

---

## 2. Pricing Model Decision

### Decision: Tiered flat pricing with seat limits as the primary upgrade driver

After evaluating three models:

| Model                                  | Verdict | Reason                                                                                                                                                                                                                                |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Per-seat (pure)**                    | No      | Mobile device companies do not want to count seats carefully. 3-person shops share logins, which is a trust and security problem. Seat-only pricing penalizes team growth.                                                            |
| **Usage-based (per IMEI / per order)** | No      | Creates unpredictable monthly bills. A wholesaler processing 2,000 IMEIs in one week cannot budget this. Ops tools require predictability.                                                                                            |
| **Tiered flat + seat limits**          | **Yes** | Predictable monthly cost. Seats are the natural upgrade trigger as teams grow. Order/item caps only on the entry tier to prevent the entry plan from replacing the mid tier. Industry standard for Cin7, inFlow, Zoho, and Unleashed. |

### Primary upgrade lever: **seats (users)**

### Secondary upgrade lever: **premium features** (advanced analytics, API, custom roles, multi-location)

### Only cap on volume: order limit on Starter tier (200 orders/month) — above that, all tiers are unlimited

---

## 3. Tier Structure & Pricing

### Three named tiers + Enterprise

Four offerings total: **Starter**, **Growth** _(push this)_, **Pro**, **Enterprise (Contact Sales)**.

The three-tier structure is optimal based on behavioral research:

- Buyers default to the middle option when unsure (the compromise effect)
- 4+ tiers cause decision paralysis for SMB buyers
- Enterprise as a 4th "contact us" anchors the Pro tier without being a real product immediately

---

### Pricing Table

|                        | **Starter**                   | **Growth** _(Most Popular)_   | **Pro**                         | **Enterprise** |
| ---------------------- | ----------------------------- | ----------------------------- | ------------------------------- | -------------- |
| **Annual price / mo**  | **CAD $99**                   | **CAD $229**                  | **CAD $449**                    | Custom         |
| **Monthly price / mo** | CAD $119                      | CAD $279                      | CAD $549                        | Custom         |
| **Billed annually**    | CAD $1,188/yr                 | CAD $2,748/yr                 | CAD $5,388/yr                   | Custom         |
| **Annual savings**     | Save CAD $240 (2 months free) | Save CAD $600 (2 months free) | Save CAD $1,200 (2 months free) | —              |

**Annual discount: exactly 2 months free (16.7%)** — framed as "2 months free" not "save 17%." Same math, more concrete framing.

---

### Target Customer Per Tier

| Tier           | Who buys it                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Starter**    | Solo supplier or 2-person operation just getting off Excel. Testing the platform before committing more.                                                       |
| **Growth**     | A 3–10 person wholesale operation running active orders. Needs team access, branded invoices, and HST reports. This is the majority of the addressable market. |
| **Pro**        | A scaling operation with 10–20 employees, multiple locations, complex reporting needs, or technical staff who want API access.                                 |
| **Enterprise** | 25+ employees, custom integrations, SLA requirements, or a multi-entity business. Custom pricing negotiated directly.                                          |

---

### Price Ratio Check (Anchoring Math)

- Starter to Growth: $99 → $229 = 2.3x (within healthy 2–2.5x range)
- Growth to Pro: $229 → $449 = 1.96x (within healthy 1.5–2x range)
- This means Growth feels like good value against both Starter and Pro — exactly the intent

---

## 4. Feature Gates Per Tier

### Core Workflow (Never Gated — Available on All Plans)

These features are available on every plan including Starter. Gating the core workflow kills trial-to-paid conversion:

- Inventory management (add, edit, view products)
- IMEI / serial number tracking
- Order creation and management
- Basic invoice generation (DeviceDock-branded)
- Basic HST / GST report
- User management (within seat limit)
- Role-based access (owner, manager, inventory_admin, analyst)
- Alerts (low stock, critical stock)
- Bulk IMEI/serial entry
- Email support

---

### Full Feature Gate Table

| Feature                                            | Starter         | Growth          | Pro                       | Enterprise      |
| -------------------------------------------------- | --------------- | --------------- | ------------------------- | --------------- |
| **Seats (users)**                                  | **3**           | **10**          | **25**                    | Unlimited       |
| **Orders / month**                                 | 200             | Unlimited       | Unlimited                 | Unlimited       |
| **Inventory items**                                | 1,000           | Unlimited       | Unlimited                 | Unlimited       |
| **Locations / warehouses**                         | 1               | 3               | Unlimited                 | Unlimited       |
| **Inventory management**                           | Yes             | Yes             | Yes                       | Yes             |
| **IMEI / serial tracking**                         | Yes             | Yes             | Yes                       | Yes             |
| **Order management**                               | Yes             | Yes             | Yes                       | Yes             |
| **Basic invoice generation**                       | Yes             | Yes             | Yes                       | Yes             |
| **Invoice branding & customization**               | No              | **Yes**         | Yes                       | Yes             |
| **Invoice payment terms & bank details**           | No              | **Yes**         | Yes                       | Yes             |
| **Basic HST / tax report**                         | Yes             | Yes             | Yes                       | Yes             |
| **Full HST reconciliation**                        | Limited         | **Yes**         | Yes                       | Yes             |
| **Role-based access control (4 built-in roles)**   | Yes             | Yes             | Yes                       | Yes             |
| **Custom roles & permission sets**                 | No              | No              | **Yes**                   | Yes             |
| **Sensitive data masking (hide cost price)**       | No              | **Yes**         | Yes                       | Yes             |
| **Bulk operations (price update, status, export)** | No              | **Yes**         | Yes                       | Yes             |
| **Excel / CSV data import**                        | Yes             | Yes             | Yes                       | Yes             |
| **Advanced analytics & BI**                        | No              | No              | **Yes**                   | Yes             |
| **Dead stock & margin analysis**                   | No              | No              | **Yes**                   | Yes             |
| **Customer (buyer) management**                    | Basic           | **Full**        | Full                      | Full            |
| **Purchase orders (supplier POs)**                 | No              | No              | **Yes**                   | Yes             |
| **Multi-location inventory**                       | No              | **Yes (3)**     | Yes (unlimited)           | Yes             |
| **Automated alerts (email, in-app)**               | Basic           | **Full**        | Full                      | Full            |
| **API access**                                     | No              | No              | **Yes**                   | Yes             |
| **Webhooks**                                       | No              | No              | **Yes**                   | Yes             |
| **Scheduled CSV/Excel exports**                    | No              | **Yes**         | Yes                       | Yes             |
| **Damage & return tracking workflow**              | No              | **Yes**         | Yes                       | Yes             |
| **Audit log (company level)**                      | 30 days         | 1 year          | Unlimited                 | Unlimited       |
| **Onboarding**                                     | Self-serve docs | Self-serve docs | **1:1 onboarding call**   | Dedicated CSM   |
| **Support**                                        | Email           | Email           | **Priority email + chat** | SLA + dedicated |
| **SSO / enterprise auth**                          | No              | No              | No                        | **Yes**         |
| **Custom domain / white-label**                    | No              | No              | No                        | **Yes**         |
| **SLA guarantee**                                  | No              | No              | No                        | **Yes**         |

---

### Gate Rationale (Why These Specific Choices)

**Invoice customization gated at Growth, not Starter:**
A company sending plain DeviceDock-branded invoices to their B2B buyers will want their own logo and payment details. This is felt as a real pain point within the first week of use — it is a natural conversion trigger from Starter to Growth.

**Full HST reconciliation gated at Growth:**
Tax reporting is a monthly or quarterly need. The Starter plan can run basic reports, but the full reconciliation workflow (regional breakdown, period comparison, CRA-ready output) becomes necessary for a real operation. The accounting pain is a reliable upgrade driver.

**Custom roles gated at Pro:**
A 3–10 person team can operate with the 4 built-in roles. A 10–25 person operation starts to need more granular control. Custom roles are a genuine need at that scale, not before.

**API / Webhooks gated at Pro:**
Only technically capable companies will use the API. These are also the companies most willing to pay Pro rates. API access signals integration maturity — a Pro customer, not a Starter customer.

**Advanced analytics gated at Pro:**
Margin analysis, forecasting, and BI are powerful but require data volume to be meaningful. Early-stage Starter companies do not yet have the data. This is both a natural fit gate and a value-driver for Pro.

---

## 5. Add-Ons

Add-ons expand usage without requiring a full tier upgrade. They protect the mid-tier revenue without being punitive.

| Add-On                                                                         | Price               | Available On    |
| ------------------------------------------------------------------------------ | ------------------- | --------------- |
| **Extra users** (per user/mo)                                                  | CAD $15/user/mo     | Starter, Growth |
| **Extra location** (per location/mo)                                           | CAD $19/location/mo | Growth          |
| **API overage** (per 1,000 calls above 10K/mo)                                 | CAD $5              | Pro             |
| **White-label branding** (remove DeviceDock logo from invoices and emails)     | CAD $49/mo          | Growth, Pro     |
| **Additional audit log retention** (+1 year)                                   | CAD $15/mo          | Starter, Growth |
| **Data migration service** (one-time, assisted import from Excel/other system) | CAD $299 one-time   | All plans       |

**Extra users add-on math:**

- Growth includes 10 users. A 12-person team adds 2 seats at $15 each = +$30/mo vs upgrading to Pro at +$220/mo.
- This is intentional — it gives small overflows without forcing a full tier jump, while Pro still wins for larger teams.

---

## 6. Free Trial Strategy

### Decision: 14-day free trial, no credit card required, full-featured access

**Why 14 days:**

- Industry standard for B2B inventory SaaS (inFlow: 14 days, Cin7: 14 days, Zoho: 14 days, Sortly: 14 days)
- Long enough to set up inventory and run a few test orders; short enough to create urgency
- 30-day trials extend the decision cycle and reduce urgency to convert

**Why no credit card required:**

- Removes the #1 psychological barrier to starting a trial
- Lowers signup friction significantly — the first goal is getting companies into the product
- DeviceDock's value becomes clear after the company loads real inventory data; the product sells itself

**Why full-featured access:**

- Gatekeeping during trial means prospects experience a limited product, not the real one
- A company that uses invoice customization and HST reconciliation during the trial will miss those features after trial → conversion happens naturally
- Mimics Growth tier features during trial to anchor the Growth plan as the obvious upgrade

**Trial-to-paid conversion benchmark:**
B2B SaaS no-credit-card free trials convert at 14–25%. With a purpose-built product that replaces a real daily workflow (vs. a general tool), the upper end of that range is achievable.

---

### Trial Expiry Flow

| Day    | Action                                                                 |
| ------ | ---------------------------------------------------------------------- |
| Day 0  | Trial starts, full Growth-tier access                                  |
| Day 7  | In-app banner: "7 days remaining — choose your plan"                   |
| Day 12 | Email: "2 days left — don't lose your data"                            |
| Day 14 | Trial expires — read-only access for 7 more days, cannot add/edit data |
| Day 21 | Data preserved but dashboard locked — "Subscribe to reactivate"        |
| Day 60 | If no subscription, company data eligible for archival (soft delete)   |

The **7-day read-only grace period** is critical — it lets companies who missed the deadline still access their data and subscribe without feeling like they lost work. This reduces the #1 reason for not converting: "I just forgot / got busy."

---

## 7. Annual vs. Monthly Strategy

### Display annual pricing as default on the pricing page

Present the pricing page with annual pricing shown by default, with a toggle to switch to monthly. This is the industry standard for maximizing annual plan uptake.

**Framing (always use this wording, never "save X%"):**

> ✓ **Annual — Get 2 months free**
> Monthly — Billed monthly, cancel anytime

### Why push annual:

- Annual customers have dramatically lower churn (locked in for 12 months minimum)
- The LTV improvement from annual commitment more than compensates for the ~17% revenue reduction vs monthly
- Annual subscribers are more invested in onboarding properly (they paid a year upfront) → better retention signals → better product feedback

### When a company will choose monthly:

- First signup — they want to try before committing
- Uncertainty about their team size in 12 months
- Cash flow sensitivity (many Canadian SMBs prefer predictable monthly cash outflows)

**Strategy:** Do not force annual. Let companies start monthly. At the 3-month mark, trigger an in-app and email offer: "Switch to annual and get 2 months free — lock in your current rate." The 3-month mark is after onboarding friction is resolved and the product habit is formed.

---

## 8. Canadian Tax & Compliance

### GST/HST on Subscriptions

DeviceDock sells a digital service to Canadian businesses. The following rules apply:

**Registration threshold:** CAD $30,000 in revenue from Canadian customers over any 12-month rolling period. Below this, GST/HST registration is optional.

**At registration:** Charge GST/HST based on the customer's province of operation (their billing address province). Rates:

| Province                                    | Rate to Charge                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alberta, BC, Manitoba, Saskatchewan         | 5% GST                                                                                                                                             |
| Ontario                                     | 13% HST                                                                                                                                            |
| Nova Scotia                                 | 14% HST                                                                                                                                            |
| New Brunswick, Newfoundland & Labrador, PEI | 15% HST                                                                                                                                            |
| Quebec                                      | 5% GST (QST is collected separately by Revenu Québec — DeviceDock does not need to register for QST until revenue from Quebec exceeds CAD $30,000) |

**B2B reverse charge:** If a customer provides a valid GST/HST registration number on their billing profile, they self-assess the tax — DeviceDock does not collect from them. Since most customers are registered businesses, this will apply to the majority of accounts. DeviceDock should collect the customer's GST/HST number during signup/billing setup.

**Invoice compliance after registration:** All DeviceDock subscription invoices must include:

- DeviceDock's GST/HST registration number
- The tax amount charged (or a note that the reverse charge applies)
- Customer's GST/HST number if reverse charge applies

**No Digital Services Tax:** Canada cancelled the DST in June 2025 before implementation. No additional tax on digital services beyond GST/HST.

### Recommended Pricing Display

Display prices as **"+ applicable taxes"** on the pricing page. Do not include tax in the displayed price. This is standard for Canadian B2B SaaS and expected by business buyers.

---

## 9. Competitor Benchmark Reference

All USD prices converted to approximate CAD at 1.40 rate for comparison.

| Competitor             | Entry Plan (CAD) | Mid Plan (CAD) | Top Plan (CAD) | IMEI-native | CAD Pricing   | No Setup Fee          |
| ---------------------- | ---------------- | -------------- | -------------- | ----------- | ------------- | --------------------- |
| **Cin7 Core**          | ~$490/mo         | ~$840/mo       | ~$1,400/mo     | No          | No (USD)      | Yes                   |
| **inFlow Inventory**   | ~$180/mo         | ~$490/mo       | ~$980/mo       | Partial     | No (USD)      | **No ($499 USD fee)** |
| **Zoho Inventory**     | ~$55/mo          | ~$111/mo       | ~$349/mo       | No          | No (USD)      | Yes                   |
| **Sortly**             | ~$69/mo          | ~$210/mo       | ~$420/mo       | No          | No (USD)      | Yes                   |
| **Unleashed**          | ~$532/mo         | ~$700/mo       | ~$1,150/mo     | No          | No (USD)      | Yes                   |
| **Katana**             | ~$419/mo         | —              | —              | No          | No (USD)      | Yes                   |
| **ERP Gold**           | Not listed       | Not listed     | Not listed     | **Yes**     | Unknown       | Unknown               |
| **DeviceDock Starter** | **$99/mo**       | —              | —              | **Yes**     | **Yes (CAD)** | **Yes**               |
| **DeviceDock Growth**  | —                | **$229/mo**    | —              | **Yes**     | **Yes (CAD)** | **Yes**               |
| **DeviceDock Pro**     | —                | —              | **$449/mo**    | **Yes**     | **Yes (CAD)** | **Yes**               |

**Takeaway:** DeviceDock is the only IMEI-native, CAD-priced, self-serve, no-setup-fee option in the market. At $229 CAD/mo for Growth, it is significantly cheaper than the closest feature-comparable tools (Cin7 at $490+, inFlow at $490+, Unleashed at $532+) while being purpose-built for the exact workflow.

---

## 10. Pricing Page Psychology

Rules for the pricing page UI based on conversion research:

### Layout Rules

1. **Show annual pricing by default** with a monthly toggle. Most visitors will see annual prices first.
2. **Mark Growth as "Most Popular"** with a visual highlight (colored border, badge). This triggers the compromise effect.
3. **Show Enterprise as a fourth column** even if it is just "Contact Sales." It anchors the Pro column as reasonable by comparison.
4. **Lead with the value, not the features.** Top of each column: "For growing teams" not just a feature list.
5. **Show the annual savings in concrete dollars**, not percentages. "Save CAD $600/year" beats "Save 17%."

### Feature List Rules

6. **List features using checkmarks**, not text paragraphs.
7. **Put the most emotionally resonant features near the top** of each column's list (invoice branding, IMEI tracking, HST reports — these are the ones that resonate with mobile device buyers).
8. **Use "Everything in [lower tier], plus:" structure** for Growth and Pro columns. This makes the upgrade feel additive, not different.
9. **Grey out (not hide) features the tier does not have.** Showing what a tier lacks is a subtle upgrade nudge without being aggressive.

### CTA Rules

10. **Primary CTA: "Start 14-day free trial"** — not "Buy now" or "Subscribe." Trial first, payment second.
11. **One CTA per column.** Do not have both "Start trial" and "Contact sales" in the same column.
12. **FAQ section below the pricing table** — address: "Can I change plans?", "What happens after the trial?", "Do you offer refunds?", "Is my data safe?", "Do you have a setup fee?". These are the 5 most common pre-purchase objections for B2B SaaS.

---

## 11. Implementation Notes

### What needs to be built before charging money

These are the minimum requirements to launch paid plans:

| Requirement                               | Notes                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Subscription management (super admin)** | Assign plans to companies, view status, override manually                                                        |
| **Plan enforcement in the app**           | Check plan tier before allowing features; show upgrade prompt if blocked                                         |
| **Billing integration**                   | Stripe is the industry standard for Canadian SaaS (supports CAD, handles tax, has strong webhook infrastructure) |
| **Subscription invoice generation**       | DeviceDock must generate its own invoices to customers showing plan, price, tax breakdown, GST/HST number        |
| **Trial countdown UI**                    | In-app banner showing days remaining in trial                                                                    |
| **Plan selection page**                   | Post-trial or post-signup page to select a plan and enter payment                                                |
| **Seat enforcement**                      | Block additional user invites when seat limit is reached; show "upgrade to add more users"                       |
| **Order/item limit enforcement**          | Starter only: block order creation at 200/month cap with upgrade prompt                                          |

### Recommended Payment Processor

**Stripe** — supports CAD billing, has tax calculation (Stripe Tax handles GST/HST by province automatically), webhook infrastructure is robust, has a standard React/Next.js SDK.

**Alternative:** Paddle — handles all tax compliance and remittance automatically, simpler for a one-person operation. Higher transaction fee than Stripe but removes the tax compliance burden entirely.

---

### What to say about pricing on the landing page (before signup)

Key messages to include:

- "Plans in Canadian dollars — no exchange rate surprises"
- "No setup fee. No mandatory onboarding cost."
- "Start free for 14 days. No credit card required."
- "Cancel anytime. Your data is always exportable."
- "Built for Canadian compliance — HST/GST reconciliation included"

---

_Document created: 2026-04-02_
_Based on: Competitor research (Cin7, inFlow, Zoho, Sortly, Unleashed, Katana, ERP Gold), SaaS pricing psychology literature, Canadian GST/HST digital services rules (post-June 2025 DST cancellation)._
