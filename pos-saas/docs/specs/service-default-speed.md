# Feature Spec — Choose default speed variant

> **Status:** Draft · **Last updated:** 2026-07-03
> **Related code:** `lib/service-transformer.ts`, `modules/services/**`, `app/(dashboard)/laundry/services/page.tsx`, `prisma/schema.prisma`

## 1. Overview & Problem
When a service has multiple speed variants (Reguler / Express 24 Jam / Express 7 Jam), the default — the one used by `defaultServiceId` consumers (e.g. `order-edit-form.tsx`, the flag-off tile click) — is auto-picked (reguler-or-first) with no owner control. Owners want to choose which variant is the default.

## 2. Users & User Stories
- As an **owner**, I want to **mark which speed variant is the default**, so that quick-adds and the flag-off flow use the one I expect.

## 3. Scope
**In:** persist `Service.isDefaultSpeed`; `transformServices` picks it as `defaultServiceId` (fallback reguler → first); a "set as default" star + `Default` badge on the services page; batch-create marks its reguler row default.
**Out:** server-side atomic sibling-clear (done client-side via two PATCHes — acceptable for an occasional owner action); per-branch-name column for server-side grouping queries.

## 4. Functional Requirements
- **FR-1** `isDefaultSpeed` flows schema → repo → service → dto → API → client.
- **FR-2** `transformServices`: `defaultServiceId` = the `isDefaultSpeed` variant, else reguler, else `variants[0]`.
- **FR-3** Setting a default from the UI clears the previous default in the same group (client sends PATCH old `{isDefaultSpeed:false}` + PATCH new `{isDefaultSpeed:true}`). Guarded by `services:edit`.
- **FR-4** Batch-create sets `isDefaultSpeed:true` on the reguler row it creates (preserves today's default).
- **FR-5** `tenantId`/`branchId` never trusted from client — the existing repo update is scoped by `branchId`.

## 5. Non-Functional
i18n via `t()` (both locales). No new flag (refinement). RBAC reuses `services:edit`. Schema change ⇒ rebuild both Docker images.

## 6. Data Model
`Service.isDefaultSpeed Boolean @default(false)`. No index (read with the service row).

## 7. API Surface
- `PATCH /api/services/[id]` now accepts `isDefaultSpeed` (already `.partial()`).
- Services page: star button per variant (only when `variantCount > 1`) → two PATCHes.

## 8. Acceptance Criteria
- **AC-1** — *Given* a 3-variant group, *When* the owner clicks the star on Express 24, *Then* Express 24 shows the `Default` badge and `order-edit-form`'s add-service uses it.
- **AC-2** — *Given* batch-create of a new group, *When* created, *Then* the reguler row is the default.
- **AC-3** — *Given* a group with no explicit default, *Then* reguler (or first) remains the default (back-compat).

## 9. Relations
| Function | Relation | Touchpoint |
|---|---|---|
| transformServices | reads isDefaultSpeed for defaultServiceId | `lib/service-transformer.ts` |
| order-edit-form | consumes defaultServiceId | `components/orders/order-edit-form.tsx:513` |

## 10. Test Plan
Manual on :3007 (rebuild both images): AC-1..AC-3. `npx tsc --noEmit` + `npm run build`.

## 11. Rollout
Schema change → `db:push` + `prisma generate` + rebuild both images. Rollback = migrate the column away (additive, so just leaving it is harmless).

## 13. Risks
- **Two-PATCH race** could leave 0 or 2 defaults transiently; transformer tolerates it (picks first true). Owner can re-set.
