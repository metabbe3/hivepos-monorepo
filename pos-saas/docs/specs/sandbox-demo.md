# Feature Spec — Sandbox Demo ("Coba Demo")

> **Status:** Draft · **Last updated:** 2026-07-03
> **Related code:** `app/api/demo/start/route.ts`, `lib/demo/sandbox.ts`, `app/demo/page.tsx`, `lib/auth.ts`, `components/shared/demo-banner.tsx`, `app/(dashboard)/layout.tsx`

## 1. Overview & Problem
Prospects can't feel hivePOS without signing up + entering real data. A self-serve **sandbox demo** lets a visitor one-click into a fresh, isolated, pre-seeded tenant, explore the full product, then it auto-expires. Competitor exposure ≈ the existing free signup (already public); guardrails: email gate, IP rate-limit, seed-only data, lazy cleanup.

## 2. Users & User Stories
- As a **prospective owner**, I want to **try hivePOS instantly without signup**, so that **I see if it fits before registering**.
- As the **business**, I want **lead capture (email) + rate-limiting**, so demos aren't abused.

## 3. Scope
**In:** `/demo` email-gate page → `POST /api/demo/start` provisions an isolated demo tenant (pre-seeded) → auto sign-in → dashboard with "Mode Demo" banner; demo tenants can't be billed; auto-expire (24h) + lazy cleanup; IP rate-limit (5/hour).
**Out:** email verification; persistent demo state; a marketing-site simulated overlay; bulk/sample data import for real tenants.

## 4. Functional Requirements
- **FR-1** `POST /api/demo/start` is IP rate-limited (5/hour); captures `email` as a lead (stored on `tenant.ownerEmail`).
- **FR-2** Provisions: `Tenant { isDemo:true, demoExpiresAt: now+24h, trialTier:"PRO", approvedAt:now, isActive:true, slug:"demo-<rand>" }`, branch (+ `DEFAULT_PICKUP_SLOTS`), synthetic owner user (`demo-<tid>@demo.hivepos.local`, random password), RBAC roles, Free/TRIAL subscription, then `seedSandbox(...)`.
- **FR-3** `seedSandbox` creates realistic sample data: ~30 customers, ~7 services (incl. one speed-variant group), ~60 orders across the last 30 days (varied statuses + a few unpaid) so dashboard stats/heatmap/piutang/top-customers populate.
- **FR-4** Lazy cleanup: on each start, `deleteMany` tenants `where isDemo && demoExpiresAt < now` (cascade).
- **FR-5** Auto sign-in: `/demo` calls `signIn("credentials",{email,password,redirect:false})` with the synthetic demo-user creds → `/dashboard`.
- **FR-6** `session.user.isDemo` surfaces via JWT; the dashboard shows a **"Mode Demo"** banner linking to `/register`.
- **FR-7** Billing checkout rejects `isDemo` tenants (demo can't be billed).
- **FR-8** `tenantId` never trusted from client; branch/tenant come from the provisioned session.

## 5. Non-Functional
- **Security:** rate-limit + synthetic email (no real-account collision); demo tenants are isolated (tenant-scoped queries unchanged). All existing tenant-scope rules (#1) apply — demo is just another tenant.
- **i18n:** all copy via `t()`, both locales.
- **Schema change** → rebuild both images.
- **Flag:** optional `sandboxDemo` kill-switch (add only if a no-deploy disable is wanted).

## 6. Data Model
`Tenant.isDemo Boolean @default(false)` + `Tenant.demoExpiresAt DateTime?`. No index (read by PK / cleanup scans the small demo set).

## 7. API Surface
- `POST /api/demo/start` — `{ email? }` → `{ email, password }` (synthetic demo-user creds).
- `/demo` page; banner mounted in dashboard layout; guard in `/api/billing/checkout`.

## 8. Acceptance Criteria
- **AC-1** — *Given* a visitor at `/demo`, *When* they submit email + "Mulai Demo", *Then* a fresh isolated tenant is provisioned and they land on `/dashboard` with sample data + the "Mode Demo" banner.
- **AC-2** — *Given* a demo session, *When* they create an order, *Then* it works (sandbox is interactive).
- **AC-3** — *Given* a demo session, *When* they hit billing checkout, *Then* it's rejected (demo can't be billed).
- **AC-4** — *Given* a demo tenant with `demoExpiresAt < now`, *When* the next demo starts, *Then* it's deleted (cascade).
- **AC-5** — *Given* 5 demo starts from one IP in an hour, *When* a 6th is attempted, *Then* 429.
- **AC-6** — *Given* `session.user.isDemo` is false (normal owner), *Then* no demo banner shows.

## 9. Relations
| Function | Relation | Touchpoint |
|---|---|---|
| Register provision | reuse pattern | `app/api/register/route.ts` |
| Auto sign-in | reuse pattern | `app/(auth)/register/page.tsx` (4a) |
| Auth jwt/session | surfaces isDemo | `lib/auth.ts` (mirror onboardingCompletedAt) |
| Billing | guarded | `app/api/billing/checkout/route.ts` |

## 10. Test Plan
Manual on :3007 (rebuild both images): AC-1..AC-6. `npx tsc --noEmit` + `npm run build`.

## 11. Rollout & Rollback
Schema change → `db:push` + `prisma generate` + rebuild both. Rollback: additive columns (harmless if unused); remove the `/demo` link to disable the path.

## 13. Risks
- **Provisioning cost (~90 rows/visit)** — bounded by rate-limit + lazy cleanup; Redis rate-limit + cron if volume grows.
- **Competitor exposure** — unchanged vs free signup; email gate is a light trail, not a barrier.
