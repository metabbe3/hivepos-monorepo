# OpenAPI Contract Audit

**Scope:** `contracts/openapi.yaml` (whole contract) · **Date:** 2026-07-23
**Lens:** `api-and-interface-design` principles — Hyrum's Law, consistent error semantics, validate-at-boundaries, addition-over-modification, pagination, predictable naming.
**Mode:** Report only. No edits to `openapi.yaml`, no regenerated types, no code. See the rejected-findings and accepted-convention sections before treating anything below as a defect.

> Sibling docs: [`BACKFILL.md`](./BACKFILL.md) (endpoint coverage ledger), [lessons-learned #2-3](../lessons-learned.md) (envelope split), [`sop/contract.md`](../sop/contract.md) (the types/docs pipeline).

---

## Health summary

| | |
|---|---|
| Paths / operations | **150 / 218** |
| Methods | GET 94 · POST 66 · PATCH 26 · DELETE 23 · PUT 1 |
| Component schemas | **93** |
| Domains (tags) | 22 — account, attendance, auth, billing, blog, branches, customers, dashboard, demo, expenses, health, inventory, orders, pickup, printers, public, pwa, reports, roles, service-groups, services, super-admin, tenant, tickets, track, users, whatsapp |

**Strong foundation — keep doing this:**
- Single shared envelope: `{ success, data, meta? }` / `{ success:false, error:{ code?, message } }`.
- Errors centralized in `components/responses` (`BadRequest`, `Unauthorized`, `NotFound`, `Forbidden`, `Conflict`) — consistent, `$ref`-able.
- 20 reusable parameters (`CustomerId`, `OrderId`, `StartDateAlias`, …) — minimal duplication.
- PascalCase schema names throughout; input DTOs cleanly split from responses (`XxxCreateInput` / `XxxEnvelope` / `XxxListEnvelope`).

Issues cluster in three places: **input validation gaps** (P0), **pagination modeling** (P1), and a **legacy dual-list-envelope convention** (P1, accepted).

---

## P0 — Input validation gaps (additive, highest value)

*Validate at boundaries.* Several request-body schemas declare a `type` but no constraints, so the contract accepts data the backend will (or should) reject. Constraints are **spec only** — this audit cannot confirm Go-side enforcement from YAML; a real fix needs the constraint **and** backend validation. Mirror the constraints already present in the contract.

> **Update (2026-07-23):** verified against `hivepos-api` — the backend **already enforces** `branchIds≥1`, `amount>0`, `months 1–36`, `name≠""`, `customerId≠""`, item qty/weight, pct-discount range, and order-status transitions (manual checks + the `validate.V` accumulator in `internal/shared/validate/validate.go`). So for those, the contract was merely stale documentation. The genuinely-new validators still needed: `planTier` enum (explicit), `customer.name` length, `customer.phone` pattern, `customerId` uuid format. Note the breaking caveat below: a contract-layer enum/format add cannot break runtime FE (FE sends identical bytes), but phone must mirror the FE's own pattern — the FE does **not** normalize.

| Schema / field (line) | Has | Missing |
|---|---|---|
| `CheckoutInput.planTier` (L7051) | `type: string`, example `GROWTH` | **`enum`** — any string accepted |
| `CheckoutInput.branchIds` (L7055) | `type: array`, desc "At least 1 required" | **`minItems: 1`** — empty array passes |
| `ExpenseCreateInput.amount` (L8013) | required, `format: double`, desc "Must be positive" | **`minimum: 0` (exclusive)** — negatives/zero pass |
| `CustomerCreateInput.name` (L7359) | required, `type: string` | **`minLength` / `maxLength`** — empty or 10k-char string passes |
| `CustomerCreateInput.phone` (L7361) | `type: string`, nullable | **`pattern` / `format`** — any string passes |
| `CreateOrderInput.customerId` (L7220) | `type: string` | **`format`** (UUID-ish) |

**Good examples to copy** (already in the contract): `CheckoutInput.months` (`minimum:1, maximum:36`), `dateFrom`/`dateTo` (`format: date`), `CustomerCreateInput.email` (`format: email`).

---

## P1 — Unpaginated lists that can grow unbounded

List endpoints that return a bare array with no `page`/`limit`/cursor:

- **`/customers` (L816)** and **`/expenses` (L1325)** — **unbounded per tenant.** Real scaling risk. *"You will need pagination the moment someone has 100+ items — add it from the start."*
- **Bounded, accept as intentional**: `/branches` (L679, plan-limited), `/expense-categories` (L1204, small category set), `/attendance/staff|status|events` (date/tenant-windowed).

**Recommendation:** keep bare-array where the result set is genuinely bounded, and annotate *why* in each endpoint's `description`. Add pagination to `/customers` and `/expenses` in a follow-up (additive: add `page`/`limit` params + a `meta` block — non-breaking for existing callers that ignore it).

> **Correction (2026-07-23, verified against FE):** the "additive, non-breaking" framing above is **wrong for this frontend.** Both `/customers` (`app/(dashboard)/customers/page.tsx`) and `/expenses` (`app/(dashboard)/laundry/expenses/page.tsx`) load the **full** returned array and paginate/sort **client-side** (expenses sorts the whole array; `CustomerList` documents a ~19k-node DOM that gated LCP/INP). Actually paginating server-side — returning a page-1 subset + stopping the full-array return — **changes wire volume and breaks that UX.** Adding the `page`/`limit` *params* is harmless, but making the endpoint *paginate* is **breaking** and needs coordinated FE work (load-more or server-side sort/filter), not a no-coordination additive change. The perf bug is real; the fix is not free.

---

## P1 — Two pagination conventions coexist (KNOWN, accepted)

This is documented legacy ([`CLAUDE.md` #9](../../CLAUDE.md), lessons-learned #2-3), **not an oversight.** Codify it rather than silently mix.

| | Shape | Carrier schema | Example |
|---|---|---|---|
| **A — tenant lists** | `{ success, data:[…], meta:{ total, page, totalPages } }` | `XxxListEnvelope` | `/orders` GET (L1506) |
| **B — `writeRows` / super-admin** | `{ success, data:{ rows, page, hasNext } }` | `XxxRowsEnvelope` | `/super-admin/billing/payments` GET (L3776) |

**Recommendation:**
- Write a top-of-file note naming **Convention A canonical for new tenant endpoints**; reserve B for `writeRows`-style admin reads.
- Convention A's `meta` **omits `limit`/`hasNext`**, so consumers hardcode the `default: 20`. Add `limit` (additive, safe) so clients can echo the resolved page size. *(Applied 2026-07-23: `limit` added to `OrderListMeta` + `PickupRequestListMeta`.)*
- **Do not force-migrate** either direction — both shapes are consumed by live FE; reshaping is breaking.

---

## P2 — Error-response DRY

Some 4xx responses inline `{ description, content:{ schema:{ $ref: ErrorEnvelope } } }` instead of `$ref: components/responses/<X>` — same wire shape, just not DRY. Examples: `/orders` GET 403 (L1577), `/branches` 403 (L712). Cosmetic refactor if ever touched; zero behavior change. *(Deferred 2026-07-23: skipped — identical generated TS either way, churn for no runtime/typed benefit. Add when those endpoints are next touched.)*

---

## P2 — Status-code semantics worth a discussion

- `/customers` POST duplicate phone → **409 Conflict**. Defensible (conflict = duplicate) — just document the code's meaning in the response description.
- `/attendance/clock` POST wrong PIN → **400**. The caller *is* authenticated; a wrong PIN is an authorization failure → 401/403 arguably fits. Minor and debatable (400 "bad input" is also defensible).

---

## Redundancy (breaking to remove — documented only)

- **`/orders/{id}/status` supports both POST and PATCH backed by one shared handler** (L1807-41). Clients may depend on either verb, so removing one is breaking. Flag for a future single-method decision. *(Verified 2026-07-23: this FE uses **PATCH only** — 3 call sites, POST never called. Safe to drop POST for this FE; external clients unknown → deprecate first.)*

---

## Not a finding (rejected as noise)

Raised by automated checks, dismissed on review:
- **`snapToken` (billing) vs `token` (auth)** — different concepts (Midtrans Snap token vs auth JWT). Correct as-is.
- **Midtrans webhook `snake_case` payload** — an external, untrusted third-party response mirrored verbatim. That is exactly what *validate-at-boundaries* prescribes for third-party data. Correct.
- **Verb-style action paths** (`/billing/promo/validate`, `/pickup-requests/count-pending`, `/attendance/quick-staff`) — RPC-style actions are defensible, and renaming is a breaking URL change. Noted as accepted convention; out of scope for a report-only pass.

---

## Hyrum's Law sidebar

Every observable behavior below is already a commitment someone may depend on:
- The `{ total, page, totalPages }` meta is observable. **Adding** `limit` is safe; **renaming/removing** fields is breaking.
- Idempotency uses a non-standard **`X-Client-Id`** header (conventional: `Idempotency-Key`). Document it; don't rename mid-flight.
- Path `id` params are `string` (PK-like). Already string-typed, so a future UUID/Snowflake migration is **non-breaking at the contract layer**. *(Verified 2026-07-23: `customers.id` is `gen_random_uuid()::text` — genuinely UUID-shaped, so `format: uuid` on `customerId` is correct, not misleading.)*

---

## Follow-up (if acted on)

All safe (additive) fixes can land without coordinated FE work: P0 constraints, the `limit` addition to Convention A meta, and the error-response `$ref` DRY pass. **Pagination of `/customers`+`/expenses` is NOT in this safe set** — see the correction in its section above; it is breaking for the current FE. Anything that reshapes responses (envelope unification, dropping the duplicate `/orders/{id}/status` verb, server-side pagination) is breaking and belongs on a `/feature` branch with parallel BE+FE — see [`sop/contract-first-feature.md`](../sop/contract-first-feature.md).
