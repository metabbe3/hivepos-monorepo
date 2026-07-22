# PORT-DEBT — hivepos-web migration ledger

Tracks what's ported-but-not-yet-wired as the frontend moves from the legacy `pos-saas`
fullstack app to the Go `hivepos-api` backend. **Update this as pages get wired / Go endpoints land.**

Status: ✅ wired (live vs Go) · 🟡 copied+builds, stubbed (renders empty) · 🔴 missing Go endpoint (errors gracefully)

Cross-reference Go readiness: `../hivepos-api/docs/endpoint-gap.md`.

---

## 1. Unwired server pages (W2 — convert prisma-stub → apiFetch)

These pages import the `@/lib/prisma` **stub** (safe-empty) or server-query lib stubs. They are
copied, build green, and `force-dynamic` (render on demand), but show empty data until converted
to client components calling the Go API. Checked = converted.

### Public / SEO — ✅ DONE (server-side `apiFetch`, no auth needed)
- [x] `app/blog/page.tsx` → `/api/public/blog-posts` (Go: ✅ shipped in `public_api` — published, newest first)
- [x] `app/blog/[slug]/page.tsx` → `/api/public/blog-posts/{slug}` (Go: ✅ shipped)
- [x] `app/tenant-site/page.tsx` → `/api/public/tenants/{slug}` + `/api/public/services` (Go: missing)
- [x] `app/(public-service)/pickup/[branchSlug]/page.tsx` → `/api/public/branches/{slug}` (Go: scaffolded)
- [x] `app/sitemap.ts` → `/api/public/blog-posts` (✅ Go) + `/api/public/tenants` (Go: missing)
- [ ] `app/(public-service)/support/page.tsx` → `/api/public/tickets`; still uses `auth()` stub (low traffic)

### Super-admin panel — 🔴 BLOCKED on auth model
These are **authed server components**. Server-side `apiFetch` can't attach the JWT (it lives in
browser `localStorage`, unreadable on the server). Two paths (pick one, both clear all 10+ pages):
1. **httpOnly cookie auth** — backend (or a thin Next BFF `/api/auth`) sets the JWT in an httpOnly
   cookie on login; server reads it via `cookies()`. Clears `lib/api/token.ts` ponytail too.
   Recommended — unblocks all authed SSR.
2. **Client-convert each page** — `"use client"` + `useEffect` apiFetch (token from localStorage).
   More mechanical churn, loses SSR (fine for admin).

Pages (all import `@/lib/prisma` stub + `requireSuperAdminPanelSession` stub):
- [x] `super-admin/(panel)/admins` — client + apiFetch
- [x] `super-admin/(panel)/tenants` — client + apiFetch (client-side search)
- [x] `super-admin/(panel)/health` — server + apiFetch `/api/health` (keeps env-var diagnostics)
- [x] `super-admin/(panel)/page` (overview) — client + apiFetch `/api/super-admin/stats`
- [x] `super-admin/(panel)/tenants/[id]` — client + apiFetch `/api/super-admin/tenants/{id}`

✅ **`lib/prisma.ts` + `lib/tenant.ts` DELETED** — prisma stub fully removed (0 refs). §1 complete.

Other panel pages (`audit-log`, `billing`, `blog`, `error-logs`, `feature-flags`, `performance`,
`peripherals`, `pickup-insights`, `plans`, `promo-codes`, `referrals`, `settings`, `tickets`,
`users`) use the server-query lib stubs (§3) — convert after the auth model lands or per-page.

Conversion pattern per page: drop `@/lib/prisma`/server-lib import → `"use client"` (if not already)
→ `apiFetch<DTO>("/api/...")` in `useEffect` → render. Remove `force-dynamic` once it no longer
touches server data.

---

## 1b. Raw-`fetch("/api/...")` debt (porting leftover) — ✅ DONE

pos-saas pages that called raw `fetch("/api/...")` broke in hivepos-web (relative `/api` → web origin
404, no Bearer). All authed ones converted to `apiFetch` (or `apiRaw` for FormData/blob/stream):

- [x] customers page + detail → apiFetch
- [x] super-admin action buttons → apiFetch: resolve, refund, tenant suspend, ticket actions, user suspend/reactivate/reset/impersonate, impersonation-stop
- [x] `apiRaw` helper added (`modules/shared/http/client.ts`) for non-JSON (FormData/blob/stream)
- [x] order-photo upload (FormData) + monthly-pnl export (blob) + ai/chat (SSE stream) → apiRaw
- [x] public forms (support-ticket, pickup-request) — work via `next.config` `/api`→Go rewrite (no auth)
- [ ] `branches/[id]` printers/scan + printers/test — client-side printer hardware discovery; needs Go endpoints or stays client-only (WebUSB). Low priority.

Pattern: `fetch(url).then(r=>r.json()).then(res=>res.data)` → `apiFetch<T>(url).then(({data})=>…)`; FormData/blob/stream → `apiRaw(url, init)`.



### ✅ Implemented in Go (works live)
`/api/health`, `/api/auth/login|me|session-version`, `/api/register`, `/api/orders`,
`/api/customers`, `/api/dashboard/*`, `/api/users`, `/api/roles` — verified (orders list live).

### 🟡 Scaffolded in Go (likely stub/error — verify against endpoint-gap.md)
- `/api/services`, `/api/service-groups`
- `/api/branches`
- `/api/stock-items` (inventory)
- `/api/expenses`, `/api/expense-categories`
- `/api/attendance/{clock,events,quick-staff,staff,status}`
- `/api/pickup-requests`, `/api/pickup-requests/count-pending`
- `/api/billing/{checkout,status,promo/validate}`
- `/api/reports/piutang-tracker`
- `/api/tenant/{onboarding,referral,website,whatsapp-templates}`
- `/api/public/{branches,pickup-requests,tickets}`
- `/api/super-admin/*` (admins, ai/chat, blog, feature-flags, plans, promo-codes, referrals, etc.)

### 🟡 Shape-mapped in Go (frontend maps Go→pos-saas shape; works live)
- `/api/orders` omits `paidAmount` → frontend defaults to 0 (remaining = totalAmount). Correct for
  UNPAID; PARTIAL orders' already-paid amount unknown until Go exposes `paidAmount`. Worked around
  in `laundry/orders/page.tsx`. Verified: payment dialog now shows correct remaining (Rp 21.000).
- `/api/super-admin/stats` uses `pendingTenants` (not `pendingApprovals`) + lacks several overview
  fields — mapped in `super-admin/(panel)/page.tsx`.
- `/api/dashboard/kanban` returns status **aggregates** (`[{status,count,sum}]`), not order rows.
  `useKanbanOrders` guards: only accepts items with `id` (real orders), else `[]` → KanbanBoard
  renders empty columns (no crash/key-warning). Order counts still show via `OrderPipelineCard`
  (mapped from `stats.orderPipeline`). Full Kanban when Go returns order rows.
- `/api/dashboard/stats` returns a leaner shape (`totalOrders/totalCustomers/totalRevenue/
  ordersByStatus/paymentBreakdown`) than pos-saas's `Stats`. `mapGoDashboardStats` in
  `app/(dashboard)/dashboard/page.tsx` maps it → dashboard renders real data (orders, omset,
  pipeline, payment breakdown). Fields Go lacks (change %, top customers, recent orders,
  cash-flow detail) default safely. Self-fetching cards (Kanban/SLA via `/api/dashboard/kanban`,
  Heatmap via `/api/dashboard/heatmap`) are wrapped in `CardBoundary` so a shape mismatch degrades
  the card instead of crashing the page.
- `/api/auth/me` omits `onboardingCompletedAt` → frontend defaults it (createdAt/marker) so the
  dashboard redirect guard doesn't force OWNERs to /onboarding. Go should send it.
- `/api/auth/me` returns `permissions: ["OWNER"]` (the **role name**), not the expanded list
  (`["orders:read", …]` / `["*"]`). Worked around in `hooks/use-permissions.ts` by merging
  `DEFAULT_ROLES` — but Go should resolve role→permissions server-side (matches pos-saas).
- `/api/tickets`, `/api/tickets/unread` — observed 404 (`ticket-bell`); needs Go tickets module
- `/api/user`, `/api/user/profile`, `/api/user/profile/oauth-link*` — profile/OAuth link
- `/api/onboarding/status` — onboarding wizard
- `/api/demo/start` — demo tenant provisioning
- `/api/print`, `/api/printers/{scan,test}` — thermal printer client features (may stay client-only)
- `/api/pwa/nonce`, `/api/super-admin/pwa/force-update` — PWA (web repo has no SW yet)
- `/api/telemetry` — web-vitals/peripherals ingestion
- `/api/auth/callback/credentials` — NextAuth internal (replaced by JWT; remove call sites)
- `/api/test`, `/api/x` — dev/debug routes (drop)

Frontend behavior on 🔴/🟡: pages call `apiFetch`, get error/404, surface via toast or empty state
(graceful — no crash). Each lights up automatically when hivepos-api ships the endpoint.

---

## 3. Stub modules in `lib/` (compile-only stand-ins for server logic now in Go)

Each is marked `// ponytail:` with its ceiling + upgrade path. Replace/convert as the owning page
gets wired (§1) or delete once nothing imports it.

| Stub | Stands in for | Upgrade |
|---|---|---|
| `lib/prisma.ts` | direct DB access in 10 server pages | convert pages to apiFetch (§1), then delete |
| `lib/auth.ts` | NextAuth `auth()` server helper | `auth()` stub → return null; remove once support page converted |
| `lib/billing.ts` | billing constants/types/calcs | move to Go; pages use `/api/billing/*` |
| `lib/super-admin/permissions.ts` | `requireSuperAdminPanelSession` | client gate on JWT claims; super-admin pages → `/api/super-admin/*` |
| `lib/{telemetry,tickets,tenant-cache,pickup-insights,audit-query,error-logs,tickets-admin,tenant-performance,user-admin,billing-analytics}.ts` | server query helpers for super-admin | super-admin pages → Go endpoints |
| `lib/get-session.ts`, `lib/feature-flags.ts` | server session/flag types | derive from JWT claims client-side |
| `app/generated/prisma/{enums,client}.ts` | Prisma enum values + `Prisma`/`PrismaClient` any | keep enums until DTOs drop the import; then delete |
| `lib/error-log-writer.ts` | DB error logging | backend owns; no-op stub |

---

## 4. Done (reference)

- ✅ 62 pages copied from pos-saas
- ✅ NextAuth → JWT client (`lib/auth-client.tsx`), 25 files swapped
- ✅ `modules/shared/http/client` → Go (origin + Bearer)
- ✅ tsc 0 errors, `next build` green
- ✅ Auth + orders live against Go (`owner@demo.com`/`demo1234`)
