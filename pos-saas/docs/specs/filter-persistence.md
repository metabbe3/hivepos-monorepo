# Feature Spec — Filter Persistence (URL-backed) + Back Buttons

> **Status:** In Progress (v1) · **Last updated:** 2026-07-02
> **Related code:** `hooks/use-url-filters.ts`, `components/shared/back-button.tsx`, the list pages.
> Template: [`docs/specs/_TEMPLATE.md`](./_TEMPLATE.md)

## 1. Overview & Problem
List pages (Orders, Customers, Inventory, Expenses, Reporting) store their filters in component
`useState`. So any navigation away — opening a detail row, switching menus, a refresh — **wipes
the filters**, forcing the user (especially the kasir) to re-apply the date/status filters every
time. The fix: back filters with **URL searchParams** so they survive navigation, refresh, and are
shareable; plus a **back button** on detail pages so returning to the list lands on the exact
filtered view.

## 2. Users & User Stories
- **As a kasir/owner**, I want to set a date + status filter, open an order, hit Back, and see the
  same filtered list — so I don't re-apply filters constantly.
- **As an owner**, I want to copy a filtered view's URL and send it — so a peer/staff opens the
  exact same filter set.

## 3. Scope
**In (v1):** `useUrlFilter` hook (filter state ↔ URL searchParams); refactor the 5 list pages
(orders, customers, inventory, expenses, reporting); a `BackButton` on detail pages.
**Out:** full breadcrumb navigation (the sidebar + back button cover navigation); tickets page
(no client filter state); persisted column layouts/sort-memory beyond filters.

## 4. Functional Requirements
- **FR-1** Each filter value (status, search, payment, sort, page, date range, custom dates) is
  read from the URL and written to it on change.
- **FR-2** Empty/default filter values are omitted from the URL (clean URLs).
- **FR-3** The text-search input stays snappy (local state) and writes to the URL **debounced**.
- **FR-4** Data/loading/progress state remains `useState` (not URL-backed).
- **FR-5** Detail pages show a Back button that returns to the list with filters intact
  (`router.back()` → the list URL with its params).

## 5. Non-Functional Requirements
- URL writes use `router.replace(..., { scroll: false })` (no scroll jump, no extra history entry
  per filter change).
- Shareable across devices (the URL carries the full filter set).
- No new dependency.

## 6. Data Model
No schema change. Filter state lives in the **URL query string**, e.g.
`/laundry/orders?status=READY&range=month&sort=createdAt_desc&page=2`.

## 7. API Surface
No API change — the list APIs already accept `status`/`search`/`dateFrom`/`dateTo`/etc. as query
params; the pages now source those values from the URL instead of local state.
- `hooks/use-url-filters.ts` → `useUrlFilter(): { get, set, searchParams }`.
- `components/shared/back-button.tsx` → `<BackButton />`.

## 8. Acceptance Criteria *(pass/fail)*
- **AC-1 (back preserves filters)** — *Given* a date filter set on the Orders list, *when* I open
  an order and click Back, *then* the list reappears with the **same** filters (date, status, sort).
- **AC-2 (refresh preserves)** — *Given* a filtered list, *when* I refresh the page, *then* the
  filters hold.
- **AC-3 (shareable URL)** — *Given* a filtered list, *when* I copy the URL into a new tab,
  *then* the same filters are applied.
- **AC-4 (clean defaults)** — *Given* all filters at default, *then* the URL has **no** query
  string (or only non-default keys).
- **AC-5 (back button)** — *Given* I'm on an order/customer/ticket/branch detail page, *then* a
  Back button returns me to the originating list with filters intact.
- **AC-6 (no regression)** — *Given* I change a filter, *then* the list re-fetches exactly as
  before (debounced search, page reset on filter change).

## 9. Relations to other functions
| Function | Relation | Touchpoint |
|---|---|---|
| List pages | refactored (filter state → URL) | `orders/page.tsx`, `customers/page.tsx`, `inventory/page.tsx`, `expenses/page.tsx`, `reporting/page.tsx` |
| Detail pages | add Back button | `orders/[id]`, `customers/[id]`, `tickets/[id]`, `branches/[id]` |
| Next.js router | depends on (searchParams) | `useSearchParams`, `useRouter().replace`, `usePathname` |
| List APIs | unchanged (already query-param driven) | `app/api/orders`, `customers`, `expenses`, … |

## 10. Test Plan / QA Gate (`docs/sop/qa-verification.md`)
- Playwright: AC-1…AC-3 on Orders (date + status); AC-1 spot-check on customers/inventory/expenses.
- `npx tsc --noEmit` + `npm run build`; rebuild the **app** image (no schema change) + hard-refresh.
- Manual: back button on each detail page returns to the filtered list.

## 11. Rollout & Rollback
- Rollout: deploy; no migration/flag (behavior refactor of existing pages).
- Rollback: revert the page refactor (git); the hook/component are additive + unused if pages
  don't call them.

## 12. Metrics / Success Criteria
- Fewer "re-applied filter" complaints; time-on-list before/after (filters now sticky).

## 13. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Refactor breaks a list page's fetch/effect deps | Verify each page via Playwright (AC-6); keep effect deps on the URL-derived values |
| URL gets long/noisy | Omit default/empty values (FR-2/AC-4); `router.replace` (no history spam) |
| Search input feels laggy | Keep input as local state; debounce-write to URL (FR-3) |

## 14. Open Questions / Follow-ups
- Persist column layout / density per page? — follow-up.
- Same pattern for the super-admin list pages? — follow-up.
