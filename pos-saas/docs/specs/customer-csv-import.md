# Feature Spec — Customer CSV Import

> **Status:** Draft · **Last updated:** 2026-07-02
> **Related code:** `app/api/customers/import/route.ts`, `components/customers/import-customers-dialog.tsx`, `lib/csv.ts` · **Flag:** `customersImportExport`

## 1. Overview & Problem
Switching from another POS (or Excel) to hivePOS today means re-entering every customer by hand — a top reason UMKM laundries don't switch. This adds a one-step CSV/Excel customer import so an owner can bring their existing customer list in bulk.

## 2. Users & User Stories
- As a **new owner switching from Excel/another POS**, I want to **upload my customer list as CSV**, so that **I don't re-type every customer**.
- As a **kasir/owner**, I want **duplicate phones skipped (not erroring)**, so that **re-importing is safe**.

## 3. Scope
**In:** upload a `.csv` (≤1000 rows), map columns `name,phone,email,notes`, bulk-insert into the active branch, skip duplicates by phone, report `{imported, skipped, errors}`.
**Out:** service/import, order-history import, **export** (intentionally excluded — lock-in), >1000 rows (streaming), multi-outlet targeting (ALL-outlets imports into the first active branch).

## 4. Functional Requirements
- **FR-1** Import is gated behind `customers:create` permission + the `customersImportExport` flag.
- **FR-2** Accepts JSON `{ rows: {name, phone?, email?, notes?}[] }`; client parses the file.
- **FR-3** Each row validated with `customerSchema`; invalid rows are skipped and reported with row number + reason, never failing the whole batch.
- **FR-4** Dedup: skip a row whose phone already exists in the target branch (`@@unique([branchId, phone])`) or appears earlier in the same batch. Rows without a phone are always inserted (NULL phones don't collide).
- **FR-5** Cap at 1000 rows/request.
- **FR-6** A downloadable template CSV (`name,phone,email,notes` + example row).
- **FR-7** `tenantId` is never trusted from the client; the target branch comes from the session guard.

## 5. Non-Functional
- **Security:** `requireWithBranchOrThrow("customers","create")`; branch from session only.
- **i18n:** all strings via `t()` in both `en` + `id`, no interpolation (`.replace`).
- **Flag:** `customersImportExport` (default `enabled:true`).

## 6. Data Model
**No schema change.** Uses existing `Customer` (`branchId`, `phone?`, `email?`, `notes?`; `@@unique([branchId, phone])`). Note: `Customer` has **no `tenantId`** column — tenant is reached via `branch`.

## 7. API Surface
- `POST /api/customers/import` — body `{ rows }` → `{ success, data: { imported, skipped, errors } }`.
- `components/customers/import-customers-dialog.tsx` — file picker, header mapping, template download, summary toast.
- Mounted: Import button in the filters toolbar of `app/(dashboard)/customers/page.tsx`.

## 8. Acceptance Criteria
- **AC-1** — *Given* a logged-in Owner, *When* they upload a 3-row CSV where 1 phone already exists in the branch, *Then* the response reports `imported:2, skipped:1` and exactly 2 new customers exist.
- **AC-2** — *Given* a CSV with a malformed row (empty name), *When* imported, *Then* that row is in `errors` with its row number and the valid rows still import.
- **AC-3** — *Given* a Kasir without `customers:create`, *When* viewing `/customers`, *Then* the Import button is hidden.
- **AC-4** — *Given* >1000 rows, *When* imported, *Then* the request is rejected with a clear validation error before any insert.
- **AC-5** — *Given* the `customersImportExport` flag is off, *When* viewing `/customers`, *Then* the Import button is hidden (kill-switch).

## 9. Relations to other functions
| Function | Relation | Touchpoint |
|---|---|---|
| Customer create | reuses validation + dedup semantics | `lib/validations.ts:customerSchema`, `modules/customers/application/create-customer.service.ts` |
| Permission guard | gates + resolves branch | `lib/permissions/check.ts:requireWithBranchOrThrow` |
| CSV output | shares `lib/csv.ts` (template uses `toCSV`) | `lib/csv.ts:toCSV` |

## 10. Test Plan
- Unit: `parseCSV` quoted/escaped edge cases (add to `lib/csv` alongside existing usage).
- Manual: AC-1..AC-5 on Docker :3007 (rebuild `app`).

## 11. Rollout & Rollback
- Ships on (`customersImportExport` default `enabled:true`). Kill = flip flag (no deploy). No schema change → `app` rebuild only.

## 13. Risks
- **Race:** customer added between dedup query and `createMany` → statement throws on `@@unique` → user retries. Acceptable.
- **ALL-outlets import** lands in the first active branch (naive; upgrade = branch picker in dialog).

## 14. Follow-ups
Service catalog import; >1000-row streaming; branch picker for multi-outlet.
