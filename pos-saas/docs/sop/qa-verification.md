# QA & Verification SOP

**Every code change ships through this gate.** No change is "done" until it passes all of it. This is the project's definition of "industry-standard, low-bug delivery." Read `docs/lessons-learned.md` for the real bugs that produced these rules.

## The QA gate (mandatory, in order)

> **Feature change?** Its `docs/specs/<feature>.md` acceptance criteria (Given/When/Then) are the pass/fail checklist — verify each one (CLAUDE.md rule #11).

1. **Understand the root cause first.** Reproduce the bug; trace the data flow. Never patch a symptom — the fix goes at the source. (See `superpowers:systematic-debugging`.)
2. **Make the minimal correct fix.** One change. No "while I'm here" refactors. Mark any shortcut with a `// ponytail:` comment (ceiling + upgrade path).
3. **Leave a check behind for non-trivial logic** (a branch, loop, parser, money/auth path). Smallest thing that fails if the logic breaks — a vitest, a Playwright e2e for the user-facing path, or an `assert`-style `demo()`. Trivial one-liners need no test (YAGNI).
4. **`npx tsc --noEmit`** → 0 errors.
5. **`npm run build`** → green (route manifest includes any new routes; no type drift in `.next`).
6. **`npm test`** → green. Add/extend a test if you touched non-trivial logic or a billing/auth/money path.
7. **Dedicated review (the "QA").** Run the **`code-review`** skill (or a reviewer subagent) on the diff. **Fix the findings before claiming done** — do not defer them. This is the second pair of eyes every change must pass.
8. **Manual/browser verification on the changed path.** Use Playwright or the MCP browser to exercise the actual user flow (not just "it compiles"). Verify at the breakpoints that matter: iPad (768) + mobile (375) for UI; the real API for data paths.
9. **Docker rebuild** — if `prisma/schema.prisma` changed, rebuild **both** images: `docker compose build app init-db && docker compose up -d` (a stale `init-db` drops new columns/tables — see lesson #2). Otherwise `docker compose build app`.
10. **Re-smoke on :3007** after the rebuild.

If any step fails, **stop and fix it** — do not mark the task done with a known failure.

## Dedicated QA = the code-review skill

Every diff is reviewed before "done." Concretely:
- Run **`code-review`** (or `/code-review`) on the working-tree diff. It flags correctness bugs, convention violations, and reuse/simplification opportunities.
- Treat findings as blocking. Fix them, then re-run until clean (or explicitly justify a deferral).
- For high-risk changes (auth, billing, money, permissions), also dispatch a **reviewer subagent** (e.g. `feature-dev:code-reviewer`) for an independent pass.

## Bug-prevention checklist (the condensed rules)

Each maps to an entry in `docs/lessons-learned.md`. Verify the relevant ones before claiming done:

- [ ] **No nested `<form>` inside `<form>`.** Inline sub-actions inside a form use `<div>` + `type="button"` + key handlers. *(Lesson 1)*
- [ ] **Schema changed ⇒ rebuilt `app` AND `init-db` images.** *(Lesson 2)*
- [ ] **Promo `type` matches intent** (`FREE_MONTH` grants months; `DISCOUNT_FIXED` only zeros the checkout months); plan-gated via `applicablePlan`; CRUD has create **and** edit. *(Lesson 3)*
- [ ] **Tier is payment-history-based** — never flip `getTenantPlan` to `planId`-based (silently downgrades Pro tenants). Enforce no-downgrade at every plan-change path. *(Lesson 4)*
- [ ] **Per-tier price comes from the Plan record** (`getTierUnitPrice`), constants are fallback only. *(Lesson 5)*
- [ ] **`signIn("credentials", …)` values arrive as strings** — lenient zod + normalize booleans/numbers in `authorize`. *(Lesson 6)*
- [ ] **`DialogContent` is height-bounded + scrollable** (`max-h-[90dvh] overflow-y-auto`); fix overflow at the shared primitive, width overrides keep the mobile fallback. *(Lesson 7)*
- [ ] **Auth inputs have `name` + `autocomplete`** (`email`/`current-password`) so password managers / Face ID work. *(Lesson 8)*

## Quick reference commands

```bash
npx tsc --noEmit                 # 0 errors
npm run build                    # route manifest + types
npm test                         # vitest
npx playwright test e2e/<file>   # the changed user flow
docker compose build app init-db # when schema changed
docker compose build app         # code-only change
docker compose up -d             # bring up the stack on :3007
```
