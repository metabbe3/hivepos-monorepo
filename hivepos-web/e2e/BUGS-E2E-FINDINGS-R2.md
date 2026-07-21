# E2E Bug Hunt Round 2 — full tenant dashboard menu

Date: 2026-07-21 · All tenant (OWNER) dashboard menus driven via Playwright + curl against dev stack (web :3008, api :8099). Round 1 covered services/inventory/expenses/customers (`BUGS-E2E-FINDINGS.md`). This round sweeps the rest: Dashboard, Reports, Orders, Pickup, Billing, Users, Roles, Branches, Website, WhatsApp Templates, Tickets, Printer, Attendance. Full suite baseline: 70 passed / 1 skipped; failures below + exploratory findings.

Severity: **P0** crash/data-loss · **P1** broken-feature · **P2** polish.

---

## P1 (fixed)

### R2-1. Reports → "Export All" silently produced an empty .xlsx (all 7 endpoints 401)
- **Repro**: /reporting → Export All.
- **Actual**: `exportAllToXlsx` used raw `fetch("/api/reports/…")` — no `Authorization` header (auth is a JWT in localStorage, not a cookie). All 7 report endpoints returned **401**; `.catch(()=>null)` swallowed them → workbook written with **zero sheets**. User gets an empty file, no error.
- **Fix**: use `apiFetch` (adds Bearer + base URL + unwraps envelope). Verified: 33KB xlsx, 10 populated sheets, 0 console errors.
- `lib/export-utils.ts:48`.

### R2-2. Reports → per-report "Export PDF/CSV" buttons (11 of them) all 401
- **Repro**: any report component's Export button (`components/reports/*.tsx`, 11 files).
- **Actual**: `exportToPdf` used `window.open("/api/reports/export?…")` — a new-tab navigation can't carry the Bearer header → **401**. Same root cause as R2-1.
- **Fix**: rewrite as an authed `fetch` (Bearer header) → blob → download. Endpoint confirmed working (200). `lib/export-utils.ts:34`.

### R2-3. Pickup → Accept crashes the detail dialog (`Cannot read properties of undefined (reading 'replace')`)
- **Repro**: /laundry/pickup-requests → open a Menunggu pickup → Terima.
- **Actual**: after accept, the dialog re-renders the customer WhatsApp link `pickup.customerPhone.replace(/\D/g,"")` but `customerPhone` is undefined (pickup has no phone, or the accept response omits customer fields) → TypeError → ErrorBoundary catches → dialog dies.
- **Fix**: null-guard — render the wa.me link only when `customerPhone` exists, else "—". Verified: accept no longer throws.
- `components/dashboard/pickup-request-detail-dialog.tsx:197`.

---

## P2 (fixed)

### R2-4. /attendance/manage rendered blank (no h1) when `staffAttendance` flag is off
- **Repro**: direct-navigate to /attendance/manage in a tenant where the flag is off (QA tenant).
- **Actual**: `if (!enabled || !shouldRender) return null;` → page returned nothing. Nav link is hidden when the flag is off, but a direct URL showed a blank page (no heading, no message). `misc-pages.spec` expects an h1 → failed.
- **Fix**: render a graceful disabled-state (PageHeader + "feature not enabled" message) instead of null. Verified: h1 + message render; misc-pages spec passes (11/11).
- `app/(dashboard)/attendance/manage/page.tsx`.

### R2-5. Billing → Midtrans sandbox popup CSP warning (not our bug)
- Console CSP error on the snap popup. The CSP with the Midtrans domain allowlist is **Midtrans's own popup CSP** (not in our source — we set no page-level CSP; grep found only Next's image CSP). Midtrans blocks its own inline script in sandbox. Not fixable on our side; sandbox-only; needs a full checkout to confirm whether it actually blocks payment. No action.

---

## Notes (not product bugs)
- **base-ui `useId` hydration mismatch** (`id="base-ui-_R_…" ` differs server vs client) logged on dashboard pages in `next dev`. Known Next-16 dev-mode quirk (documented in `customers.spec.ts` comment); does not occur / is handled in prod builds. Pervasive but dev-only.
- **Delete-with-dependents**: probed expense-category (→ ON DELETE SET NULL, expenses orphaned cleanly with `categoryId:null`), customer orders/deposits (→ BUSINESS_RULE_VIOLATION, fixed round 1). Pattern is handled; no new 500s found across menus.
- **Date-decode anti-pattern** (round-1 expenses bug): does not recur — attendance sends RFC3339; other update handlers (branches/customers/inventory/services-group) decode into entities with no user-editable `time.Time` field.
- Orphan E2E data still accumulates across runs (FlowCust/SearchCust/Pickup) — test-hygiene, round-1 note.

---

## Coverage this round
Dashboard ✓ · Reports ✓(+export fixed) · Orders (status flow ✓) · Pickup ✓(accept fixed) · Billing (CSP noted) · Users/Roles/Branches/Website/WhatsApp/Tickets/Printer: happy-path CRUD covered by passing specs; cross-cutting patterns (delete-deps, date-decode, raw-keys, undefined, auth-on-export) probed — no new defects.
