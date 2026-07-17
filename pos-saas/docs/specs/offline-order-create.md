# Feature Spec / PRD — Offline Order Create (completion)

> **Status:** Shipped (MVP — flag default OFF) · **Last updated:** 2026-07-06
> **Related code:** `lib/offline/*`, `app/(dashboard)/laundry/orders/new/new-order-context.tsx`, `app/(dashboard)/laundry/orders/page.tsx`, `components/shared/offline-*` · **Flag:** `offlineOrderCreate` (defaults OFF)

## 1. Overview & Problem

hivePOS targets Indonesian UMKM laundry where internet drops mid-transaction. The
offline-order-create **infrastructure is already built and production-quality** —
IndexedDB outbox (`lib/offline/db.ts`), `createOrderOffline`, a retried/idempotent
`drainOutbox` sync engine (posts to `/api/orders` + `/api/customers` with
`X-Client-Id`), `OfflineBanner`/`OfflineSyncManager`, `useOnlineStatus`/`useSyncStatus`,
server-side `findByClientId` idempotency, full en+id i18n, and unit + E2E tests.

Three gaps keep it from being **usable + compliant**:
1. The `!online` create branch runs **regardless of the `offlineOrderCreate` flag**
   (non-negotiable #3 violation — the flag exists, defaults OFF, but is never checked).
2. Offline orders are written to IDB then the kasir is redirected to `/laundry/orders`,
   which **never reads IDB** — pending orders are invisible until sync completes.
3. Rows that fail sync (`status:"error"`) sit in IDB with **no retry/delete UI**.

This spec completes the feature by wiring the flag + surfacing pending orders + error
recovery — reusing all existing infra. No new IDB stores, no new API endpoints, no
schema change.

## 2. Users & User Stories

- As a **kasir**, I want to create an order while offline and **see it saved** in the
  orders list (as `PENDING-XXXXXX`), so I know it wasn't lost.
- As a **kasir**, I want pending orders to **sync automatically on reconnect** and
  visibly flip to their real order number, so the ledger stays accurate.
- As a **kasir**, I want to **retry or delete** an order that failed to sync, so a
  stuck row doesn't block the outbox.
- As an **owner**, I want the feature **off by default** and toggleable per-tenant,
  so I only enable it where I've validated it.

## 3. Scope

**In (this version):**
- Flag-gate the offline create branch + the sync-manager drain behind
  `useFeatureFlag("offlineOrderCreate")`.
- "Pending sync" section on `/laundry/orders`: lists IDB `pendingOrders`
  (status pending/syncing/synced/error) with `PENDING-XXXXXX`, items, total, status
  badge; live-updates via `useSyncStatus`.
- Per-row **retry** (re-`drainOutbox`) + **delete** (`deletePendingOrder`) for errored rows.
- Graceful "offline create disabled" state when flag OFF + offline.

**Out (follow-ups / explicit non-goals):**
- Offline receipt / print page for `PENDING-XXXXXX` (deferred — toast only for now).
- Pending-order detail page (read-only).
- Pending-customer visibility on `/customers`.
- Cache-warm "offline ready" toast.
- Server-side flag guard on `/api/orders` (shared endpoint — idempotency via
  `X-Client-Id` is the safety; the flag is a client-side feature gate).

## 4. Functional Requirements

- **FR-1** When `offlineOrderCreate` is OFF, the `!online` create branch does NOT
  write to IDB; submit shows an error toast ("offline create disabled") and aborts.
- **FR-2** When ON + offline, submit writes via `createOrderOffline` (existing),
  shows the `PENDING-XXXXXX` id, and the order appears in the Pending sync section.
- **FR-3** `/laundry/orders` reads `listPendingOrders()` and renders a "Pending sync"
  section (only when the flag is ON). Each row shows id, line items, total, status.
- **FR-4** On reconnect (or manual "Sync now"), `drainOutbox` runs (existing); rows
  transition pending → syncing → synced in the UI via `useSyncStatus`; synced rows
  are purged after 24h (existing `purgeOldSyncedRows`).
- **FR-5** A row in `status:"error"` shows its `lastError` and offers Retry + Delete.
  Retry re-runs `drainOutbox`; Delete removes the row from IDB (`deletePendingOrder`).
- **FR-6** `OfflineSyncManager` only triggers `drainOutbox` when the flag is ON.

## 5. Non-Functional Requirements

- **Flag:** `offlineOrderCreate`, default OFF (`prisma/seed-flags.ts`), per-tenant
  override via `FeatureFlagOverride`. Client resolves via `useFeatureFlag`.
- **i18n:** reuse existing `offline.*` keys (en+id already present). Any new strings
  (e.g. retry/delete button labels, "offline create disabled") added to BOTH locales
  (rule #4), no interpolation.
- **A11y:** status badge dual-coded (color + text); retry/delete buttons keyboard-
  reachable with `aria-label`; section is a landmark region.
- **Security/tenancy:** no change — sync posts to existing tenant-scoped
  `/api/orders` + `/api/customers` with the session's `ctx.tenantId`; `X-Client-Id`
  idempotency unchanged.
- **Perf:** IDB reads are local + fast; `listPendingOrders` runs on mount + on
  `useSyncStatus` change; no polling loop (event-driven).

## 6. Data Model

**No Prisma change.** Reuses:
- IDB `pendingOrders` store (`lib/offline/db.ts`) — `PendingOrderRow` with
  `status: "pending"|"syncing"|"synced"|"error"`, `clientId`, `pricedItems`,
  `totalAmount`, `serverOrderNumber`, `lastError`.
- `Order.clientId` + `Customer.clientId` (Prisma, already `@unique`/indexed) for
  server-side idempotency.

## 7. API Surface

- **No new endpoints.** Sync continues to target `POST /api/orders` +
  `POST /api/customers` (with `X-Client-Id`).
- **Client components:**
  - `new-order-context.tsx` — add `useFeatureFlag("offlineOrderCreate")` gate on the
    `!online` branch (FR-1/FR-2).
  - `OfflineSyncManager` — gate the drain trigger on the flag (FR-6).
  - New: a `PendingOrdersSection` component (mounted on `/laundry/orders` when flag
    ON) reading `listPendingOrders()` + `useSyncStatus`, with retry/delete actions.
- **Mounted:** `PendingOrdersSection` at the top of `/laundry/orders` (above the
  server orders list), only when `useFeatureFlag("offlineOrderCreate")`.

## 8. Acceptance Criteria

- **AC-1 (flag-off blocks offline create)** — *Given* `offlineOrderCreate` is OFF and
  the browser is offline, *When* the kasir submits a new order, *Then* no row is
  written to IDB and an "offline create disabled" toast shows; the online submit
  path is unchanged when online.
- **AC-2 (flag-on offline create is visible)** — *Given* the flag is ON and offline,
  *When* the kasir submits, *Then* a `PENDING-XXXXXX` row appears in the Pending sync
  section of `/laundry/orders` with the correct items + total.
- **AC-3 (auto-sync on reconnect)** — *Given* a pending row exists, *When* the
  browser reconnects, *Then* the row transitions to syncing → synced and acquires its
  real `orderNumber`; the server has exactly one order for that `clientId`
  (idempotency).
- **AC-4 (manual sync)** — *Given* pending rows + online, *When* the kasir clicks
  "Sync now" (existing OfflineBanner button), *Then* `drainOutbox` runs and rows sync.
- **AC-5 (error retry)** — *Given* a row in `status:"error"`, *When* the kasir clicks
  Retry, *Then* `drainOutbox` re-attempts it; on success it becomes synced.
- **AC-6 (error delete)** — *Given* an errored row, *When* the kasir clicks Delete +
  confirms, *Then* the row is removed from IDB and disappears.
- **AC-7 (flag-off hides the section)** — *Given* the flag is OFF, *Then* the Pending
  sync section is not rendered on `/laundry/orders` even if stale IDB rows exist.
- **AC-8 (i18n)** — *Given* locale `id`/`en`, *Then* every offline string (incl. new
  retry/delete/disabled) renders in the active locale.

## 9. Relations to other functions

| Function | Relation | Touchpoint |
|---|---|---|
| `createOrderOffline` | reuses (gates caller) | `lib/offline/offline-order-create.ts` |
| `drainOutbox` | reuses (gates trigger + retry) | `lib/offline/sync-engine.ts` |
| `listPendingOrders` / `deletePendingOrder` | reuses (read + delete) | `lib/offline/db.ts` |
| `useOnlineStatus` / `useSyncStatus` | reuses (drive UI) | `lib/offline/use-*.ts` |
| `OfflineBanner` / `OfflineSyncManager` | reuses (mount unchanged; manager gated) | `components/shared/offline-*.tsx`, `app/(dashboard)/layout.tsx` |
| `/api/orders` POST | unchanged (idempotent via `X-Client-Id`) | `app/api/orders/route.ts` |
| `useFeatureFlag` | reuses (gate) | `hooks/use-feature-flag.ts` |
| new-order submit | mutates (adds flag gate on `!online` branch) | `app/(dashboard)/laundry/orders/new/new-order-context.tsx:~401` |
| orders list | mutates (mounts PendingOrdersSection) | `app/(dashboard)/laundry/orders/page.tsx` |

## 10. Test Plan / QA Gate

Per `docs/sop/qa-verification.md`:
- **Unit:** extend `lib/offline/offline.test.ts` — flag-gate logic (mock
  `useFeatureFlag`), PendingOrdersSection render for each status, retry/delete
  handlers call `drainOutbox`/`deletePendingOrder`.
- **E2E (Playwright):** extend `e2e/offline-order-create.spec.ts` — AC-1 (flag-off
  blocks), AC-2 (pending visible), AC-3 (auto-sync idempotent), AC-5/AC-6 (retry/delete).
  Use the existing offline network-throttle/IDB harness.
- **Manual:** DevTools → offline; create order; verify PENDING row + reconnect sync;
  force a 500 to test error recovery. Mobile 375 + tablet 768.
- **QA gate:** root-cause → minimal fix → `tsc` → `build` → `npm test` (green) →
  `code-review` on the diff → manual verify. AC-1..AC-8 ARE the pass/fail.

## 11. Rollout & Rollback

- **Rollout:** flag `offlineOrderCreate` stays default OFF; enable per-tenant via
  super-admin `FeatureFlagOverride` for dogfooding → broader. No schema change, no
  migration, no PWA force-update required (client JS).
- **Rollback:** flip the flag OFF — offline create aborts gracefully (FR-1), the
  Pending section hides (AC-7). Existing IDB rows drain or age out (24h TTL). No deploy.

## 12. Metrics / Success Criteria

- Pending orders created offline reach `status:"synced"` without duplicates
  (idempotency holds — zero `clientId` collisions server-side).
- No stuck `error` rows older than 1 session that the kasir can't self-recover
  (retry/delete both work).
- Zero regressions in the online order-create path (AC-1 guard).

## 13. Risks & Mitigations

- **Abuse / tamper:** IDB is client-controlled. Mitigation: server validates every
  payload + `X-Client-Id` idempotency (existing anti-tamper E2E covers this); the
  server is the source of truth, IDB is only an outbox.
- **Stuck error rows:** mitigated by FR-5 retry/delete + 24h `purgeOldSyncedRows`.
- **Flag-off stale rows:** if the flag turns off with rows in IDB, they stop syncing
  (FR-6) but remain readable until deleted/aged out — acceptable (owner disabled the
  feature intentionally).
- **Online-path regression:** FR-1 only adds a gate on the `!online` branch; the
  online submit path is untouched. Covered by AC-1 + existing online E2E.

## 14. Open Questions / Follow-ups

- Offline receipt / print for `PENDING-XXXXXX` (deferred — MVP shows toast + list row).
- Pending-customer visibility on `/customers` (deferred).
- Cache-warm readiness toast (deferred).
- Server-side flag guard on `/api/orders` for offline-origin posts (deferred — client
  gate + idempotency suffice for MVP).
