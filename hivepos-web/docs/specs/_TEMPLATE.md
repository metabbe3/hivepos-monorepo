# Feature Spec / PRD — `<feature name>`

> **Status:** Draft | In Review | Shipped | Deprecated
> **Owner:** `@handle` · **Last updated:** `YYYY-MM-DD`
> **Related code:** `path/to/files` · **Flag:** `<flagKey>` (if behind one)

Copy this file to `docs/specs/<feature>.md` and fill it in. Treat it as a **living document**
— update it when scope, data, or behavior changes. Every section below has a one-line purpose;
delete the guidance line once written. Structure follows current PRD + acceptance-criteria
best practice (Atlassian/AltexSoft for AC, Aha/Perforce for PRD, Slack/Fictiv for tech specs).

---

## 1. Overview & Problem
*What's broken or missing today, and why this feature exists. One paragraph. The "why" before the "what."*

## 2. Users & User Stories
*Who benefits, and the jobs they need done. Use "As a `<role>`, I want `<X>`, so that `<Y>`."*
- As a …
- As a …

## 3. Scope
**In (this version):** …
**Out (follow-ups / explicit non-goals):** …

## 4. Functional Requirements
*Numbered, testable statements of behavior (FR-1, FR-2 …).*
- **FR-1** …
- **FR-2** …

## 5. Non-Functional Requirements
*Security, performance, a11y, i18n, limits, the feature flag it ships behind.*

## 6. Data Model
*New/changed Prisma models + fields + indexes + the state machine for any status enum. Reference `prisma/schema.prisma`.*

## 7. API Surface
*Endpoints (method + path + auth + purpose), client hooks/components, and where it's mounted in the UI. Reference `app/api/...` and `components/...`.*

## 8. Acceptance Criteria *(the pass/fail for code verification)*
*Each criterion independently testable. Prefer **Given / When / Then** (BDD) so a QA engineer can pass/fail each. These mirror the test plan in §9.*
- **AC-1 (title)** — *Given* …, *When* …, *Then* …
- **AC-2** — …

## 9. Relations to other functions
*A table of the features/systems this touches or depends on, and how. The "blast radius" map — read before changing this feature or its neighbors.*

| Function | Relation | Touchpoint |
|---|---|---|
| … | depends on / mutates / gates | `file:fn` |

## 10. Test Plan / QA Gate
*How it's verified, mapped to `docs/sop/qa-verification.md`: unit tests, the e2e/Playwright path, the DB-level proof, and the manual breakpoints (iPad 768 / mobile 375 / real API).*

## 11. Rollout & Rollback
*How it ships (flag default, deploy, schema/migration, backfill, PWA force-update) and how it's killed (flag flip, no deploy).*

## 12. Metrics / Success Criteria
*The numbers that say it worked (and the threshold that says stop).*

## 13. Risks & Mitigations
*What can go wrong (abuse, cost, failure modes) and the guard already in place for each.*

## 14. Open Questions / Follow-ups
*Unresolved decisions + explicit next-version work.*
