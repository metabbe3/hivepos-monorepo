# E2E Bug Hunt Findings — services / inventory / expenses / customers

Date: 2026-07-21 · Method: Playwright browser drive + curl API probes against live web (:3008) + api (:8099), tenant `qa-tenant-1` (OWNER). Baseline specs (20) pass; findings below are from exploratory edge-case driving beyond happy-path coverage.

Severity: **P0** crash/data-loss · **P1** broken-feature/data-integrity · **P2** polish/i18n/a11y.

---

## P1

### 1. `[expenses]` Editing an expense always fails (400 "Invalid JSON body")
- **Repro**: create an expense → click the row's edit (pencil) icon → change any field → Save.
- **Actual**: `PATCH /api/expenses/{id}` → `400 VALIDATION_ERROR "Invalid JSON body"`. Nothing updates.
- **Root cause**: FE `<input type="date">` sends `date` as date-only `"2026-07-10"`. BE `update` (`hivepos-api/internal/modules/expenses/routes.go:113`) decodes the body **directly into the domain entity** whose `Date` field is `time.Time`; `time.Time.UnmarshalJSON` rejects date-only → decode fails. **Create works** because it decodes into `application.CreateExpenseInput` (DTO with `Date string`). Asymmetric contract.
- **Proof**: `curl PATCH … -d '{"…,"date":"2026-07-10",…}'` → 400; same body with `"date":"2026-07-10T00:00:00Z"` → 200.
- **Fix**: decode into a DTO with `Date string` (mirror create) or accept date-only in the entity; or have the FE send RFC3339.

### 2. `[inventory]` Negative-quantity stock movement corrupts stock
- **Repro**: stock item qty=10 → Record Movement, Type=Stock In, Quantity=`-5`, Save.
- **Actual**: `201 success`, `currentQuantity` 10 → **5**. An `IN` movement with negative qty silently *subtracts*. Bypasses the insufficient-stock guard (that only fires on `OUT`).
- **Root cause**: FE quantity `spinbutton` has no `min=0`; BE applies `currentQuantity += quantity` with no sign guard.
- **Proof**: `curl POST /stock-items/{id}/movements -d '{"type":"IN","quantity":-3,…}'` → 201, qty 5→2.
- **Fix**: `min=0` on FE input + BE rejects `quantity <= 0`.

### 3. `[inventory]` OUT over-draw returns HTTP 500 (should be 422)
- **Repro**: stock qty=5 → Record Movement, Type=Stock Out, Quantity=`100`, Save.
- **Actual**: `POST …/movements` → `500 INTERNAL_ERROR "insufficient stock: have 5.00, need 100.00"`.
- **Root cause**: business rule (insufficient stock) returned as a 500 server error instead of `422/400 VALIDATION_ERROR`. Wrong status code; breaks clients that branch on status; reads as a server crash. (Inverse of the recent "surface silent errors" work — here an error is over-surfaced with the wrong code.)
- **Fix**: map "insufficient stock" to a 422 AppError.

### 4. `[customers]` Delete customer with wallet/deposit history → 500
- **Repro**: customer with a Top-Up deposit (e.g. E2E ZeroOrders, balance 50k) → Delete Customer → confirm.
- **Actual**: `DELETE /api/customers/{id}` → `500 INTERNAL_ERROR "Internal server error"`; customer not removed; no friendly message.
- **Root cause**: `Delete` (`hivepos-api/internal/modules/customers/infrastructure/repository.go:299`) is a bare `DELETE FROM "Customer"` with no dependent handling. The `DepositTransaction → Customer` FK (RESTRICT) aborts the delete → unhandled Postgres error → generic 500. The **orders** case IS handled (returns `400 BUSINESS_RULE_VIOLATION "…have N order(s)"` + FE "blocked" UI); **deposits** are not.
- **Proof**: delete customer w/ orders → 400 BRV; delete customer w/ deposit (no orders) → 500.
- **Fix**: pre-check deposits (and any other dependents) → return BRV; or resolve/delete-orphan deposits per business rule.

---

## P2

### 5. `[services]` Raw i18n key `services.deactivate` rendered as button label
- Expanded service card's deactivate button shows literal **"services.deactivate"** instead of "Nonaktifkan"/"Deactivate". (`app/(dashboard)/laundry/services/page.tsx`, missing key in i18n table.)

### 6. `[services]` Raw i18n key `commissionValue` as field label
- When Commission Type ≠ NONE, the commission-value input's label is literal **"commissionValue"** (every other field on the form is translated). Also no unit hint (Rp vs %).

### 7. `[services]` Premature cross-field validation
- On the Add/Edit Service dialog, typing into any field (e.g. Description) immediately surfaces **"Nama wajib diisi"** on the untouched Name field, before submit. DynamicForm re-validates all fields on every change.

### 8. `[customers]` Literal "undefined" on detail page for zero-order customers
- `/customers/[id]` for a customer with no orders renders **"Last Visit `undefinedd` ago"** and **"Avg Between `undefinedd`"** — null `daysSinceLastOrder` / `avgDaysBetweenOrders` interpolated into the string. (`app/(dashboard)/customers/[id]/page.tsx`.) Note: the page does *not* crash (recent null-hardening held) — only the text is wrong.

### 9. `[expenses]` Row edit/delete icon buttons have no accessible name
- The edit (pencil) and delete (trash) buttons in each expense row have no `aria-label`/`title`/text → invisible to screen readers.

### 10. `[services]` i18n locale mix on one form
- Add/Edit Service form mixes English ("Per Kilo", "Pricing Type", "Commission Type", "Save") with Indonesian ("Tanpa Komisi", "Persen (%)", "Flat") despite locale cookie. Other modules (inventory, expenses) are consistently ID.

---

## Notes (not product bugs)
- **Orphan E2E test data persists** across runs: services `E2E Kiloan/Satuan/SearchSvc`, customers `E2E FlowCust ×N` (from `order-flow.spec.ts`, not cleaned by `customers.spec.ts` cleanup which only matches `^(E2E|Searchable|Should)`). Test-hygiene gap.
- **Inventory card collapse**: Record Movement / Movement History buttons only appear after clicking the card (expand-on-click). The `inventory.spec.ts` `test.skip("Delete (deactivate)… REQUIRES HUMAN REVIEW")` is this collapse behavior, not a product defect.
- **Auth note for MCP-driven testing**: `storageState` token injection works, but a hand-truncated JWT (sig broken) → 401 → app clears token → redirect to `/login`. Full-token login-in-page works fine. Not a bug — flagging so future browser-driven sessions use a full token.

---

## Suggested fix order
P1 #1, #2, #4 are user-facing data-loss/broken-feature on common flows. #3 is a status-code contract bug. P2 #5/#6/#8 are quick i18n/null-guard one-liners. Each P1 fix should land with a regression e2e spec (the existing specs would not have caught any of these).
