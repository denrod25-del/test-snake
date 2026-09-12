---
title: Field Service Ops MVP - Plan
type: feat
date: 2026-09-12
topic: field-service-ops-mvp
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# Field Service Ops MVP - Plan

## Goal Capsule

- **Objective:** Ship a multi-tenant field-service product (new independent brand, name TBD) so a plumbing/HVAC/electrical shop can Book → Dispatch → Job → collect payment on-site via tech mobile web — dogfooded as shop #1 and sellable to other shops as simpler + cheaper than ServiceTitan/Jobber.
- **Product authority:** This plan owns the v1 pay-closed core loop only. Broader ServiceTitan-parity modules and polished marketing site packaging are not active scope.
- **Open blockers:** None for planning start. Final public brand name and list pricing are deferred (see Outstanding Questions).
- **Stop conditions:** Do not reverse-engineer or copy ServiceTitan proprietary UI/APIs; do not ship memberships, marketing automation, payroll, QuickBooks sync, inventory/POs, native apps, or fleet/GPS in this plan; do not present fabricated property intelligence as live.

## Product Contract

### Summary

A new-brand, multi-tenant ops app for home-services shops. v1 is a thin office (CSR booking, online request queue, dispatch board, simple pricebook) plus a strong tech mobile-web finish that invoices and collects card/ACH on-site. Florida property briefing is an optional job add-on, not the primary pitch.

### Problem Frame

Home-services shops need the money loop — book the call, put a tech on it, finish the job, get paid — without buying an enterprise suite. The builder wants to sell that product; running their own shop on it is the dogfood path. Existing DeedScout property/permit signals can enrich a job later, but are not the reason a contractor buys day one.

### Key Decisions

- **Dogfood + sell on one multi-tenant system** `(session-settled: user-directed — chosen over single-shop-first or white-label-later: sell the same system you run)` — Governs R1, R2.
- **Pay-closed core loop (Approach A)** `(session-settled: user-directed — chosen over office-first ServiceTitan-lite or briefing-led: matches simpler + cheaper)` — Governs R3–R12.
- **Primary wedge: simpler + cheaper; hero proof: on-site pay; add-on: FL property briefing** `(session-settled: user-approved — chosen over treating all three as co-primary: clear pitch and build order)` — Governs R12, R13.
- **Tech field UX is mobile web, not native** `(session-settled: user-directed — chosen over office-only updates or native apps)` — Governs R8.
- **On-site card/ACH collect before leave** `(session-settled: user-directed — chosen over invoice-only or customer remote pay as the v1 payment path)` — Governs R10, R11.
- **Booking = CSR form + customer online request (office confirms)** `(session-settled: user-directed — chosen over CSR-only or full self-scheduling)` — Governs R4, R5.
- **Multi-trade from day one (plumbing, HVAC, electrical)** `(session-settled: user-directed — chosen over plumbing-only or your-shop-trade-only)` — Governs R3.
- **New independent brand, not DeedScout-branded** `(session-settled: user-directed — chosen over DeedScout module or decide-later for positioning)` — Governs R1.
- **Independent product, not a ServiceTitan clone** — workflows inspired by the category; UX and data model are original — Governs all Rs.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan owns the **Field Service Ops v1 pay-closed core**. The broader “ServiceTitan-category” breakdown below is the current understanding, not a committed roadmap.

- Field Service Ops v1 (this plan)
  - **Enables** selling to other shops and dogfooding shop #1
  - **Can proceed independently of** DeedScout marketing surfaces
- Florida property briefing on the job
  - **Depends on** job address + existing/ related briefing capability (see `docs/plans/2026-08-15-001-feat-service-property-intelligence-api-plan.md`)
  - **Still to decide** exact embed UX inside the job screen during planning
- Later FSM modules (memberships, marketing, payroll, accounting sync, inventory, native apps, fleet)
  - **Depends on** stable shop/customer/job/payment core from this plan
  - **Outside v1** by explicit product decision

### Actors

- A1. Shop owner (account admin, pricebook, sees payments)
- A2. CSR / office staff (books jobs, confirms online requests)
- A3. Dispatcher (assigns techs/time on the board)
- A4. Technician (mobile web: status, notes, invoice, collect pay)
- A5. Customer (submits online service request; receives service; may pay on-site)
- A6. Shop tenant boundary (isolation unit for all shop data)

### Requirements

**Tenancy and brand**

- R1. The product ships under a new independent brand (final public name may land after functional MVP).
- R2. Every shop is an isolated tenant: customers, jobs, users, pricebook rows, invoices, and payments for shop A are never visible to shop B.

**Jobs and trades**

- R3. A shop can create and manage jobs tagged as plumbing, HVAC, or electrical (same product for all three trades).
- R4. A CSR can create a customer (or select existing) and book a job with trade, problem description, service address, and preferred time window.
- R5. A customer can submit an online service request; the request appears in an office queue until a CSR confirms it into a scheduled job or declines it.
- R6. A dispatcher can view a day board of unassigned and scheduled jobs and assign a technician plus time window.
- R7. A job supports a clear field lifecycle: at least En route, On site, and Done (plus unpaid-complete with balance due when payment is not collected).

**Tech mobile web**

- R8. A technician can open an assigned job on a phone browser, update status, add notes and photos, and complete the job without a native app.
- R9. Office users can also update job status and invoice details when the tech cannot.

**Invoice and payment**

- R10. Before leaving, the tech (or office) can build an invoice from simple pricebook line items and optional custom lines.
- R11. The tech can collect card or ACH payment on-site from the phone; successful collection marks the job paid (partial payment leaves a visible balance due).
- R12. Shop owner can see which jobs were paid today (and outstanding balances) without leaving the product.

**Pricebook**

- R13. Each shop maintains a basic pricebook (name, trade, price) sufficient to build invoices; advanced catalog/features are out of scope.

**Property briefing add-on**

- R14. When a job has a service address and briefing data is available, users can open an optional Florida property briefing on the job with honest Live/Cached/unavailable labels; missing data must not be invented.
- R15. The product pitch and primary navigation treat property briefing as optional upside, not the core workflow.

**Admin**

- R16. Shop owner can invite users and assign roles among owner, CSR, dispatcher, and technician (a person may hold more than one role).

### Key Flows

- F1. CSR books a job
  - **Trigger:** Phone/walk-in customer needs service.
  - **Actors:** A2, A5, A6
  - **Steps:** Find/create customer → create job (trade, issue, address, window) → job appears for dispatch.
  - **Outcome:** Job is ready to assign.
  - **Covered by:** R3, R4, R2

- F2. Online request → confirmed job
  - **Trigger:** Customer submits web request.
  - **Actors:** A5, A2
  - **Steps:** Request enters queue → CSR confirms schedule or declines → confirmed request becomes a job.
  - **Outcome:** No unattended public self-scheduling; office stays in control.
  - **Covered by:** R5

- F3. Dispatch assignment
  - **Trigger:** Jobs need techs for the day.
  - **Actors:** A3, A4
  - **Steps:** Open board → assign tech + window → tech sees job on mobile web.
  - **Outcome:** Tech knows where to go and when.
  - **Covered by:** R6, R8

- F4. Field complete + get paid
  - **Trigger:** Tech finishes work on site.
  - **Actors:** A4, A5, A1
  - **Steps:** Status to Done → build invoice from pricebook → collect card/ACH on phone → job paid (or balance due) → owner sees payment on today’s list.
  - **Outcome:** Money collected before the truck leaves when payment succeeds.
  - **Covered by:** R7–R12

- F5. Optional property briefing
  - **Trigger:** Tech or office wants address context before/during the job.
  - **Actors:** A4, A2, A3
  - **Steps:** Open briefing from job → read labeled fields → continue job workflow.
  - **Outcome:** Extra context without blocking book/dispatch/pay.
  - **Covered by:** R14, R15

- F6. Second shop signup
  - **Trigger:** Another contractor creates an account.
  - **Actors:** A1 (new shop), A6
  - **Steps:** Create shop tenant → invite users → use same loops on empty isolated data.
  - **Outcome:** Sellable multi-tenant behavior proven beyond dogfood.
  - **Covered by:** R1, R2, R16

### Acceptance Examples

- AE1. Cross-tenant isolation
  - **Covers:** R2
  - **Given:** Shop A has customer “Rivera” and a paid job; Shop B is a separate tenant.
  - **When:** Shop B user searches customers or jobs.
  - **Then:** Rivera and Shop A’s job/payment never appear.

- AE2. Online request requires office confirm
  - **Covers:** R5
  - **Given:** Customer submitted an online request for HVAC no-cool.
  - **When:** No CSR has confirmed it.
  - **Then:** It is not a dispatched scheduled job; it remains in the request queue until confirmed or declined.

- AE3. On-site pay success
  - **Covers:** R10, R11, R12
  - **Given:** Tech has completed work and built an invoice with pricebook lines.
  - **When:** Card/ACH collection succeeds on the phone.
  - **Then:** Job shows paid; owner’s today view includes that payment.

- AE4. Unpaid completion visible
  - **Covers:** R7, R11
  - **Given:** Tech marks Done but payment fails or is skipped.
  - **When:** Owner or CSR opens the job.
  - **Then:** Balance due is visible; job is not treated as fully paid.

- AE5. Honest briefing gaps
  - **Covers:** R14
  - **Given:** Job address has parcel data but no permit cache.
  - **When:** User opens property briefing.
  - **Then:** Parcel fields show with trust labels; permit history is unavailable/Coming Soon — not invented.

### Success Criteria

- SC1. Dogfood shop can run a real call through book → dispatch → tech mobile complete → on-site pay without spreadsheets.
- SC2. A second shop account can run the same loop on isolated data.
- SC3. A contractor demo can complete “job → paid” on a phone browser in one continuous path.
- SC4. Pitch and UI hierarchy lead with simpler ops + get paid; property briefing is discoverable but not required to finish a job.

### Scope Boundaries

**In scope (v1)**

- Multi-tenant shops; roles; CSR booking; online request queue; dispatch board; job lifecycle; simple pricebook; invoices; on-site card/ACH; tech mobile web; optional FL property briefing on the job.

**Deferred for later**

- Memberships / service agreements
- Marketing campaigns / reputation tools
- Payroll / wage time tracking
- QuickBooks / full accounting sync
- Inventory, parts trucks, purchase orders
- Native iOS/Android apps
- Fleet / GPS tracking
- Full customer self-scheduling
- Rich estimates/proposals suite beyond invoice line items
- Enterprise ServiceTitan feature parity

**Outside this product's identity**

- Reverse-engineering or copying ServiceTitan proprietary clients, APIs, or trade dress
- Presenting demo/sample property data as live intel

### Dependencies / Assumptions

- A payment processor suitable for on-site card/ACH from mobile web will be chosen in planning (Stripe or equivalent).
- Florida property briefing may reuse or call existing DeedScout / Service Property Intelligence work where it fits; v1 core loop must still work if briefing is unavailable.
- “Simpler + cheaper” is the positioning; exact public price and plan tiers are not fixed in this contract.
- Working title in-repo may be “Field Service Ops” until the public brand name is chosen.

### Outstanding Questions

**Deferred to Planning**

- Q1. Final public brand name and domain.
- Q2. List price / packaging tiers for “cheaper.”
- Q3. Payment provider and on-site collect UX details (card reader vs keyed/tap-to-pay web).
- Q4. Monorepo location and stack choices for the new app vs reuse of existing Netlify/Supabase patterns.
- Q5. How deeply the SPI/property briefing embeds in the job UI for v1 (link-out vs inline panel).
- Q6. Whether estimates exist as a separate document type or invoices alone cover v1 quoting.
