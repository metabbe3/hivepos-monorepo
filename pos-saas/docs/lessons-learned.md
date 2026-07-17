# Lessons Learned

A catalog of real bugs shipped against this codebase, each with **Symptom → Root cause → Fix → Prevention rule**. Append-only: add new lessons at the bottom as new bugs surface. The condensed rules also live in `docs/sop/qa-verification.md`.

---

## 1. Inline customer-create wiped the order form

- **Symptom**: On `/laundry/orders/new`, creating a customer inline (the picker's "Create & Select" form) did not auto-select the customer and reloaded/wiped every item already in the cart.
- **Root cause**: The inline create UI was a `<form onSubmit={handleCreateCustomer}>` rendered **inside** the outer order `<form onSubmit={handleSubmit}>`. Nested `<form>` elements are invalid HTML; the inner submit bubbled to the outer form's `handleSubmit`, firing the order submit. The inner handler called `e.preventDefault()` but never `e.stopPropagation()`.
- **Fix**: Replaced the inner `<form>` with a `<div>`, changed the submit button to `type="button"` with `onClick`, and added an Enter-key handler on the inputs. (`app/(dashboard)/laundry/orders/new/customer-picker.tsx`)
- **Prevention rule**: **Never nest a `<form>` inside another `<form>`.** For an inline sub-action inside a form, use a `<div>` + `type="button"` + explicit key handlers. Grep new UI for `<form` inside `<form>`.

## 2. Stale Docker `init-db` image after a schema change

- **Symptom**: After changing `prisma/schema.prisma`, `docker compose up -d` failed with `init-db didn't complete successfully: exit 1`.
- **Root cause**: `docker compose build app` rebuilds only the `app` image. The `init-db` image still had the **old** schema baked in; its `npx prisma db push` compared old-schema vs the live DB (which had the new column/table) and tried to **drop** it → Prisma's data-loss guard → exit 1.
- **Fix**: Rebuild **both** images after any schema change: `docker compose build app init-db`.
- **Prevention rule**: **Schema changed ⇒ `docker compose build app init-db`** (never just `app`). The init-db image must always match the current `schema.prisma`.

## 3. Promo type & duration / plan-restriction

- **Symptom**: Promo `BETATESTER` gave only 1 month at Pro instead of a long Pro period; admin couldn't restrict a promo to a plan tier.
- **Root cause**: `DISCOUNT_FIXED 79000` only zeroes out the months you check out (1 month). There was **no `applicablePlan`** field on `PromoCode`, the super-admin promo API only **created + toggled** (no edit), and `validatePromoCode` ignored plan.
- **Fix**: Added `PromoCode.applicablePlan` (FREE/GROWTH/PRO|null); enforced it in `validatePromoCode(code, tenantId, planTier)` + checkout; added a **PUT edit** endpoint + tier selector + website toggle to the promo UI; reconfigured `BETATESTER` to `FREE_MONTH ×12, Pro-only`. Remember: **`FREE_MONTH` grants months; `DISCOUNT_FIXED` only zeros the months checked out.**
- **Prevention rule**: Pick the promo `type` by intent. Gate promos by tier via `applicablePlan`. Every CRUD surface needs create **and** edit.

## 4. Pro plan could be downgraded

- **Symptom**: A Pro tenant could check out / be moved to a lower tier.
- **Root cause**: No downgrade guard in checkout (`create-checkout.service.ts` defaulted to Growth), the billing UI, or super-admin `change_plan`.
- **Fix**: Checkout resolves `effectiveTier` from `getTenantPlan(tenantId)` and forces PRO when the tenant is already PRO; billing UI disables Growth for Pro tenants; super-admin `change_plan` blocks PRO→lower.
- **Prevention rule**: **`getTenantPlan` is payment-history-based** (any PAID payment with `unitPrice ≥ PRO_PRICE` = PRO). Never flip it to `Subscription.planId`-based — that would silently downgrade existing Pro tenants whose cached `planId` is Growth. Enforce "upgrade/extend only" at every plan-change path.

## 5. Plan pricing was hardcoded

- **Symptom**: Editing a plan's price in super-admin had no effect on billing.
- **Root cause**: Checkout used `PRICE_PER_OUTLET` / `PRO_PRICE_PER_OUTLET` constants, not the `Plan.priceMonthly` configured in the DB.
- **Fix**: Added `getTierUnitPrice(tier)` (reads the active Plan's `priceMonthly`, falls back to constants) wired through the billing repo; checkout uses it. Plan prices are now configurable.
- **Prevention rule**: **Per-tier unit price comes from the Plan record** (`getTierUnitPrice`), not constants. Keep the constant as a fallback only.

## 6. NextAuth form-encoded credentials broke boolean parsing

- **Symptom**: After adding a `remember` boolean to the credentials login, login silently failed (stayed on `/login`).
- **Root cause**: `signIn("credentials", { remember: true })` is sent as **form-urlencoded** — the boolean arrives in `authorize` as the **string** `"true"`. `z.boolean()` rejected it → `safeParse` failed → `authorize` returned `null`.
- **Fix**: Lenient zod (`remember: z.any().optional()`) + normalize in `authorize`: `const rememberBool = remember === true || remember === "true";`.
- **Prevention rule**: **Anything passed through `signIn("credentials", …)` arrives as a string.** Use a lenient zod shape and normalize in `authorize` (booleans, numbers). (The existing `scope` string worked because it was already a string.)

## 7. Modals overflowed on iPad

- **Symptom**: On tablet, modal content (payment forms, tables) exceeded the frame / had no scroll.
- **Root cause**: The base `DialogContent` primitive had no `max-h` and no `overflow-y-auto`; the default width was `sm:max-w-sm` (384px) — too narrow for forms; `DialogFooter` used negative margins.
- **Fix**: At the **primitive** (`components/ui/dialog.tsx`): `flex flex-col max-h-[90dvh] overflow-y-auto`, widened default to `sm:max-w-md`, refined visuals; inset sticky header/footer (cascades to all ~20 modals with zero call-site changes). Mirrored on `AlertDialogContent` + `SheetContent`. Also fixed per-modal `max-w-[NNNpx]` overrides that clobbered the mobile fallback.
- **Prevention rule**: **Fix modal overflow at the shared primitive, not per modal.** Every `DialogContent` must be height-bounded + scrollable. Width overrides use `max-w-[calc(100%-2rem)]` as the mobile fallback.

## 8. Login didn't trigger password-save / Face ID autofill

- **Symptom**: iPad/desktop never offered to save the password or autofill via Face ID.
- **Root cause**: Login inputs rendered with `id` but **no `name` or `autocomplete`** attributes — iOS Safari/Chrome keychain couldn't recognize them as a credential pair.
- **Fix**: Added `autocomplete?: string` to `FieldDef`; `DynamicForm` passes `name` + `autoComplete` to inputs; login schemas set `email` → `autocomplete="email"`, `password` → `autocomplete="current-password"` (plus a real `<form>` + submit button, which already existed).
- **Prevention rule**: **Login/signup inputs must have `name` + `autocomplete`** (`email`/`username`, `current-password`/`new-password`) so password managers + Face ID work. Also bumped `session.maxAge` to 30d and added a "Remember me" toggle.
