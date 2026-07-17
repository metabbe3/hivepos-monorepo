# Feature Spec — Piutang Tracker (AR Aging + Monthly Timeline + Payment History)

> **Status:** In Progress (v2 — unpaid-only per-month w/ year grouping + Kas Masuk) · **Last updated:** 2026-07-05
> **Related code:** `app/api/reports/piutang-tracker/route.ts`, `components/reports/piutang-tracker-report.tsx`, `app/api/reports/monthly-pnl/route.ts`, `components/reports/monthly-pnl-report.tsx`
> Template: [`docs/specs/_TEMPLATE.md`](./_TEMPLATE.md)

## 1. Overview & Problem
The owner needs to track ALL piutang (receivables): how much is outstanding per month, when each
debt was paid, and the full payment history — so nothing slips through. The existing "Outstanding"
report shows *who* owes + the oldest order, but not the **monthly timeline**, **aging buckets**, or
**per-order payment history**. This report closes that gap.

## 2. Users & User Stories
- **As an owner**, I want to see how much piutang was created each month and how much is still
  unpaid — so I know which months have outstanding debt.
- **As an owner**, I want to see the age of each outstanding debt (0-30, 31-60, 61-90, 90+ days) —
  so I can prioritize collections.
- **As an owner**, I want to see the full payment history per order (when + how much + method) —
  so I can answer "kapan ini dibayar?" definitively.

## 3. Scope
**In (v1):** monthly piutang timeline (by order creation month); aging buckets (current snapshot);
per-order detail with expandable payment history; reporting tab; CSV export.
**In (v2, 2026-07-05; revised):** the per-month list shows **unpaid orders only**, grouped under **year headers** (years descending). Paid-order + payment-date visibility moved to Laporan Bulanan's **"Kas Masuk Bulan Ini"** memo (cash collected that month, incl. late payments of prior months' piutang, broken down by origin month) — the Piutang tab is now a pure collections to-do list.
**Out:** automated collection reminders (separate feature); credit terms/limits per customer.

## 4. Functional Requirements
- **FR-1** Monthly timeline: for each month in the date range → new orders, new piutang (total),
  paid so far, still outstanding, fully-paid count.
- **FR-2** Aging buckets: currently outstanding orders grouped by age (0-30, 31-60, 61-90, 90+ days).
- **FR-3** Per-order detail: each order with its full payment history (amount, paidAt, method).
- **FR-4** CSV export for reconciliation.
- **FR-5** Respects branch scope + the standard date-range filter (WIB-correct).
- **FR-6 (v2, revised)** The per-month list shows **outstanding (unpaid) orders only**, grouped by creation month and nested under **year headers** (years descending; months within a year descending). A month with Rp 0 outstanding does not appear. Paid-order + payment-date visibility lives in Laporan Bulanan's "Kas Masuk" (FR-7), not here.
- **FR-7 (v2 cash-flow, monthly-pnl)** "Kas Masuk Bulan Ini" = Σ `Payment.amount` with `paidAt` in the selected month, branch-scoped. Shown as a **memo line only** — NOT added to accrual Pemasukan or Laba/Rugi (avoids double-counting prior-month piutang already booked as income when earned). Also returned as a **per-origin-month breakdown** (`cashCollectedByMonth`) grouping the same payments by the originating order's `receivedAt ?? createdAt` month, so the owner sees how much of the month's cash is current-month sales vs prior-month piutang collections.

## 5. Non-Functional
- Read-only (no mutations). Uses `buildDateFilter` (WIB) + `UNPAID_PAYMENT_STATUSES`.
- Performance: one main query (orders + payments included) + one aging query (outstanding snapshot).

## 6. Data Model
No schema change. Uses `Order` (totalAmount, paidAmount, paymentStatus, receivedAt, createdAt) +
`Payment` (amount, paidAt, paymentMethod per order) + `Customer` (name).

## 7. API Surface
`GET /api/reports/piutang-tracker?from=&to=` → `{ monthlySummary, agingBuckets, totalOutstanding, orders }`.

## 8. Acceptance Criteria *(pass/fail)*
- **AC-1** *Given* a date range, *then* the monthly timeline shows each month with new piutang,
  paid so far, still outstanding, fully-paid count.
- **AC-2** *Given* outstanding orders, *then* aging buckets show the count + amount per age group.
- **AC-3** *Given* any order in the detail, *then* expanding it shows every payment (date + amount
  + method) in chronological order.
- **AC-4** *Given* the report, *then* CSV export produces one row per order with payments serialized.
- **AC-5 (v2, revised)** *Given* a July order that gets fully paid, *then* it no longer appears in the Piutang per-month list (unpaid only); its collection is visible in Laporan Bulanan's "Kas Masuk Bulan Ini" for the month it was paid. *Given* outstanding spans Dec 2026 and Jan 2027, *then* the list renders a `2027` year header (Jan) above a `2026` header (Dec).
- **AC-6 (v2 no double-count)** *Given* a June order paid late in July, *then* July's Pemasukan and Laba/Rugi are unchanged (accrual); July's "Kas Masuk Bulan Ini" **includes** that late payment.
- **AC-7 (v2 breakdown)** *Given* July cash includes a July-order payment and a June-order late payment, *then* "Kas Masuk Bulan Ini" breakdown shows "Bulan ini" (July origin) and "Juni (piutang)" as separate rows; their amounts sum to the total `cashCollected`.

## 9. Relations
| Function | Relation | Touchpoint |
|---|---|---|
| Reports | new report tab | `app/(dashboard)/reporting/page.tsx` |
| Billing/payments | reads | `Payment` model, `Order.paidAmount`/`paymentStatus` |
| Date filter | reuses | `buildDateFilter` (`lib/format.ts`) |
| Laporan Bulanan (monthly-pnl) | companion cash-flow view | `app/api/reports/monthly-pnl/route.ts` (`cashCollected`), `components/reports/monthly-pnl-report.tsx` |

## 10. Test Plan
- tsc + build; Playwright: open the report → monthly timeline renders; expand an order → payment
  history shows; aging cards sum to total outstanding.

## 11. Rollout / Rollback
- Additive (new report tab); no flag needed (not a new gated feature, just a new report).
- Rollback: remove the tab + component + API.
