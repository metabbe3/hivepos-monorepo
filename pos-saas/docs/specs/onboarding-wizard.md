# Feature Spec — Onboarding Wizard

> **Status:** Draft · **Last updated:** 2026-07-02
> **Related code:** `app/(dashboard)/onboarding/page.tsx`, `app/api/tenant/onboarding/route.ts`, `lib/auth.ts`, `app/(dashboard)/dashboard/page.tsx` · **Flag:** `onboardingWizard`

## 1. Overview & Problem
A new owner lands straight on a dense analytics dashboard showing zeros, with no "do this next." This guides them through setup (prices, outlet details, first order) once, instead of leaving them to discover the app.

## 2. Users & User Stories
- As a **new owner**, I want to **be guided through setup**, so that **I don't feel lost on a screen of zeros**.
- As a **new owner**, I want to **skip setup**, so that **I can just start ringing orders**.

## 3. Scope
**In:** a guided `/onboarding` checklist (links to existing config pages + first order); a `Tenant.onboardingCompletedAt` gate; OWNER auto-redirected from `/dashboard` until completed/skipped; one PATCH to mark complete.
**Out:** inline editing of services/branch inside the wizard (links to existing pages instead); live step-completion detection; employee/kasir onboarding.

## 4. Functional Requirements
- **FR-1** Only OWNER sessions are redirected; Kasir/Staff/Super-admin never are.
- **FR-2** Redirect fires only while `onboardingCompletedAt` is null AND the `onboardingWizard` flag is on.
- **FR-3** `/onboarding` "Done"/"Skip" → `PATCH /api/tenant/onboarding` sets `onboardingCompletedAt = now()`, then `update({refreshOnboarding:true})` so the JWT reflects it (prevents a redirect loop), then `router.replace("/dashboard")`.
- **FR-4** `onboardingCompletedAt` resolves in every jwt path: credentials login, Google OAuth, impersonation swap, and the update-trigger refresh (rule #8 spirit).

## 5. Non-Functional
- **Security:** PATCH guarded by `requirePermissionOrThrow("branches","edit")` (owner-level); `tenantId` from session only.
- **i18n:** all strings via `t()`, both `en` + `id`.
- **Flag:** `onboardingWizard` (default `enabled:true`).
- **Schema change** → rebuild BOTH Docker images.

## 6. Data Model
`Tenant.onboardingCompletedAt DateTime?` (nullable; null = not onboarded). No index needed (read via PK lookups in auth + 1 update). Mirrors `approvedAt`/`websitePublishedAt` nullable-timestamp pattern.

## 7. API Surface
- `PATCH /api/tenant/onboarding` — `{ success, data: { ok: true } }`.
- `app/(dashboard)/onboarding/page.tsx` — client checklist + Done/Skip.
- Mounted: auto-redirect from `/dashboard` (useEffect) for OWNER when not onboarded.

## 8. Acceptance Criteria
- **AC-1** — *Given* a fresh OWNER login, *When* they hit `/dashboard`, *Then* they're redirected to `/onboarding`.
- **AC-2** — *Given* on `/onboarding`, *When* they click "Done", *Then* `onboardingCompletedAt` is set and `/dashboard` loads without re-redirect.
- **AC-3** — *Given* a Kasir login, *When* they hit `/dashboard`, *Then* they are NOT redirected to `/onboarding`.
- **AC-4** — *Given* `onboardingWizard` flag off, *When* an OWNER hits `/dashboard`, *Then* no redirect (kill-switch).
- **AC-5** — *Given* the owner skips, *When* they next log in, *Then* no redirect.

## 9. Relations to other functions
| Function | Relation | Touchpoint |
|---|---|---|
| Auth jwt/session | surfaces the gate field | `lib/auth.ts` (credentials, google, impersonation, update-trigger, session cb) |
| Dashboard | redirect source | `app/(dashboard)/dashboard/page.tsx` useEffect |
| Welcome panel (Init 4c) | composes — zero-customer tenants still see it after skipping | `app/(dashboard)/dashboard/page.tsx` |
| Branch edit perm | guards the PATCH | `lib/permissions/check.ts:requirePermissionOrThrow` |

## 10. Test Plan
Manual on Docker :3007 (rebuild BOTH images for the schema change): AC-1..AC-5; verify no redirect loop.

## 11. Rollout & Rollback
- Ships on (`onboardingWizard` default `enabled:true`). Kill = flag flip (no deploy). Schema change needs `db:push` + rebuild both images.
- **One-time nudge:** existing owners whose JWT predates this field get redirected once; they Skip and aren't bothered again.

## 13. Risks
- **Redirect loop** if the JWT doesn't refresh after PATCH → mitigated by `refreshOnboarding` update signal.
- **Global one-time nudge** for existing users → acceptable (early stage); dismissable.

## 14. Follow-ups
Live step-completion detection; branch-picker for multi-outlet; per-step inline editing.
