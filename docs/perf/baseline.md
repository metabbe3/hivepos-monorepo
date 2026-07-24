# Performance baseline — hivePOS whole stack

Captured 2026-07-24 on branch `perf/baseline-and-n1-fix`. Local env (Docker `hivepos-postgres-1`, api `go run :8099`, web `next build`).

Scope: `/performance-optimization` invoked with no target → user chose **whole stack**, **no prior data**. This doc is the measured baseline + the fix deltas. Synthetic-only — GA4 RUM not yet wired (`NEXT_PUBLIC_GA_ID` pending).

---

## Backend — dashboard heatmap N+1 (FIXED)

`hivepos-api/internal/modules/dashboard/infrastructure/repository.go` `GetHeatmap`.

Measured against largest tenant `0384a051…` (1549 orders, 17 customers) via `EXPLAIN ANALYZE`:

| Phase | Queries | DB exec time | Round-trips |
|---|---|---|---|
| **OLD** customerVisits | 1 top-10 + 10 per-customer day-dist = **11** | 1.6ms + (1.26ms × 10) ≈ **14.2ms** | **11** |
| **NEW** customerVisits | 1 GROUP BY customer×dow = **1** | **3.27ms** | **1** |

Full heatmap call: OLD 14 queries → NEW 7 (customerVisits 11→1; hourlyByDay/revenueByDay/revenueTrend unchanged). Response shape preserved (`customerVisits[].{customerId,name,totalOrders,dayDistribution}`).

**Scale note:** absolute saving is modest at 1.5K orders (~11ms + 10 RTTs). The win **amplifies with data + latency** — at 15K orders each per-customer query slows further and the 10 RTTs dominate over a real network. The fix removes round-trip amplification entirely (constant 1 query regardless of customer count).

Verify: `go vet ./...` clean, `go build ./...` OK, `go test ./internal/modules/dashboard/...` pass.

## Backend — infra baseline (unchanged, regression floor)

- `/api/health` p50 ≈ **1.5ms** (local, 5 samples: 1.2–2.2ms).
- `/metrics` (Prometheus) live — `http_request_duration_seconds` histogram + `http_requests_total` counter per method/route/status. Scrape for future p95 regression.
- pgx pool: 25 open / 10 idle / 1h lifetime. `statement_timeout=15000ms`.
- Pagination present on list endpoints. This heatmap N+1 was the **only** query-in-a-loop in `internal/modules/**` (206 `QueryContext/QueryRow` calls scanned).

## Frontend — structural baseline

- `next build` green — **58 routes** prerendered.
- Landing `/` (`app/page.tsx`): server components throughout; only `LandingNav` + `LandingFAQ` are client (legit — scroll-spy + accordion). Hero is text/CSS, **no `<img>`** → no LCP-image risk.
- Next.js sends immutable cache headers on `/_next/static/*` natively (no manual config needed).
- **Removed:** 4 unused 4K brand PNGs (`public/brand/mark-*-4k.png`, `lockup-*-4k.png`) = **1.4MB** dead weight, zero code refs. Dir deleted.

**Deferred to GA4 RUM:** real-user LCP/INP/CLS on landing. Synthetic Lighthouse not run this pass — landing is structurally low-JS/zero-image, low CWV risk; real-user data (`NEXT_PUBLIC_GA_ID` + `hooks/use-web-vitals-reporter.ts`) is the authoritative baseline when the ID arrives. If a synthetic pass is wanted before then, run `next start -p 3008` + Lighthouse Mobile on `/`.

---

## Phase C triggers (gated — do NOT ship speculatively)

Re-evaluate only if real-user/synthetic data crosses these:

| Fix | Trigger | Where |
|---|---|---|
| `dashboard/stats` query consolidation (17 sequential) | BE p95 > 200ms | `repository.go:73-583` |
| `ScrollReveal` shared-observer dedup | FE INP > 200ms or TBT > 200ms | `components/landing/*` (12 instances) |
| client→server component audit | FE initial JS > 200KB gz | landing client components |
| dashboard result cache (TTL 5m, tenant+branch key) | BE dashboard p95 > 300ms under load | dashboard module |

## Out of scope (flagged risk)

DB indexes on hot columns (`Order.customerId`, `orderNumber`, date ranges) — Prisma owns schema (`hivepos-api/CLAUDE.md` non-negotiable #1). If slow-query log (Phase A4) shows seq scans, raise as a schema task, not an api change.
