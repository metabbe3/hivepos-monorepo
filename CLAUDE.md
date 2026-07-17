# CLAUDE.md

hivePOS — Kasir laundry ringan di browser, UMKM.
Next.js 16 App Router, React 19, Prisma 7 (PostgreSQL), NextAuth v5, Tailwind 4,
Vitest, Playwright. Bilingual (`en` + `id`). Dev port **3007**.

## Quick start

```bash
npm install
npm run db:push        # apply schema (no migrations folder)
npm run db:seed        # demo tenant + plans + super-admin
npx tsx prisma/seed-flags.ts   # idempotent flag upsert (15 flags)
npm run dev            # http://localhost:3007
```

Test/verify before ship:
```bash
npx tsc --noEmit       # 0 errors
npm run build          # route manifest includes new routes
npm test               # vitest
npx playwright test    # e2e
```

> **Feature work? Spec first** — write/update `docs/specs/<feature>.md` (from `_TEMPLATE.md`, Given/When/Then acceptance criteria) **before** code. See Non-negotiable #11.

> **Navigation: RAG-first** — before grep/Read to *locate* code, query structural index: `npx tsx scripts/codebase-rag.ts query "<term>"` returns exact symbol + `file:line` + signature + who references in **one** call (vs. 5–20 reads). `symbol <Name>` exact, `callers <name>` references. `grep`/`Read` only if RAG miss. Re-index after changes (`codebase-rag.ts index`, SHA-256 delta sync, no LLM cost). **Default for every task** (`/goal`, `/impeccable`, bug fixes, features) — cuts navigation tokens ~10×. See `docs/sop/codebase-rag.md`.

## Stack at a glance

| Tech | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | App Router, server components, API routes. Standalone output. |
| React | 19.2.3 | UI runtime |
| TypeScript | 5.7.0 | Strict, `@/*` path alias |
| Prisma | 7.5.0 | ORM + `@prisma/adapter-pg` (PostgreSQL 17) |
| NextAuth | 5.0.0-beta.31 | credentials + Google OAuth, JWT strategy |
| Tailwind | 4.1.0 | `@tailwindcss/postcss` |
| Vitest | 4.1.9 | Unit tests, 80% coverage threshold |
| Playwright | 1.60.0 | E2E, baseURL `localhost:3007` |
| Zod | ^4.3.6 | Body / form validation |
| Midtrans | ^1.4.3 | Payment gateway (Snap.js) |
| Sonner | ^2.0.7 | Toasts |
| Recharts | ^3.8.1 | Charts |

## Non-negotiables

Rules exist cause breaking them caused real bugs. Verify each before claim task done.

1. **Every tenant-scoped query filter by `tenantId` from session.** Never trust client-supplied `tenantId` — use `ctx.tenantId` from permission guard. Inside `prisma.$transaction`, pass explicit to every `create`.
2. **Every super-admin mutation write `auditLog` row** in same `prisma.$transaction`. Action namespaced `<domain>.<verb>` (e.g. `tenant.suspend`, `billing.refund`).
3. **Every feature ship behind flag.** Default `enabled: true`. Add to `FLAG_KEYS` + `prisma/seed-flags.ts` + seed DB — + spec (rule #11) if new feature.
4. **Every user-facing string go through `t("key")`** with entries in **both** `en` + `id` in `lib/i18n.ts`. No interpolation — manual `.replace("{name}", value)`.
5. **Every new RBAC check need resource declared** in `lib/permissions/definitions.ts` (`RESOURCES` + `RESOURCE_ACTIONS` + `RESOURCE_LABELS`).
6. **Mark deliberate shortcuts** with `// ponytail: <ceiling> — <upgrade path>`. These regenerate `PONYTAIL-DEBT.md`.
7. **Sidebar filter rule**: both `hasFlag(item.flag) AND can(item.resource, item.action)` stay. Remove either break DRY gating.
8. **Touch `lib/auth.ts` jwt callback**: feature flags must resolve all paths — credentials login, Google OAuth, session refresh, impersonation swap.
9. **Every change pass QA gate** (`docs/sop/qa-verification.md`): root-cause → minimal fix → `tsc` → `build` → `test` → **dedicated review** (run `code-review` / reviewer subagent on diff, fix findings) → manual/browser verify on changed path. No "done" with known failure. **For feature, spec acceptance criteria (rule #11) ARE QA checklist.**
10. **Schema change ⇒ rebuild BOTH Docker images** (`docker compose build app init-db`). Stale `init-db` re-runs `prisma db push` with old schema, drops new columns/tables. Known gotchas catalogued in `docs/lessons-learned.md`.
11. **Spec-first for features.** Before code for new feature or material behavior change, create (or update) `docs/specs/<feature>.md` from `docs/specs/_TEMPLATE.md` — incl. **Given/When/Then acceptance criteria** (become QA pass/fail) + **relations-to-other-functions** map. Code follows spec; update spec when scope change (living doc). **No spec, no feature code.** Exempt: bug fixes (use `systematic-debugging`), typos, pure refactors, config/doc changes adding no new behavior. Think mandatory plan-mode for features — testable criteria upfront = fewer bugs.

## Brand voice & positioning

**One-liner**: Kasir laundry ringan di browser, untuk UMKM Indonesia.

**Primary slogan**: "Kasir laundry, tinggal buka browser."

### Positioning
- **Target**: UMKM laundry (1-5 outlets, owner-operated). NOT big chains.
- **Differentiator**: browser-native, no install, transparent per-outlet pricing.
- **Reference brand**: Shopify (lightweight, practical-but-aspirational, "anyone can start").
- **Anti-patterns not followed**: heavy iPad POS (Moka-style), all-in-one suites (Majoo-style), Android-hardware bundles (Qasir-style).

### Voice rules
1. **Bahasa Indonesia, casual-professional.** "Anda" for CTAs, casual for marketing.
2. **No buzzwords.** "Dashboard real-time" ok. "AI-powered synergy" not.
3. **Concrete > abstract.** "2 menit" not "cepat". "Rp 49K/outlet" not "terjangkau".
4. **UMKM-friendly.** Avoid English-only phrases. Avoid jargon unless explained inline.
5. **Dogfooding = proof, not lead.** "Dibuat dan dipakai sendiri di laundry kami" = supporting badge under hero — not hero itself.
6. **Anti-bloat implicit.** Frame as "tanpa ribet", "tanpa install", "tanpa kontrak mahal". Never name competitors.
7. **Indonesian context = native.** Pickup, kiloan, QRIS, e-wallet, WhatsApp — not exotic, the default.

### Do
- Lead with browser-native + UMKM-laundry
- Use concrete numbers (2 menit, Rp 49K, 1 outlet gratis)
- Show honest proof (dogfooding, transparent pricing, real stats)

### Don't
- Pretend to be enterprise ("platform", "solution", "ecosystem")
- Use hype words ("revolusioner", "game-changer", "next-gen")
- Promise features we don't have (offline mode, hardware bundles)
- Bash competitors by name
- Lead with dogfooding backstory — supporting proof, not hook

## Doc map

| File | Read when… |
|---|---|
| `docs/architecture.md` | Understand how app wired (auth, session, Prisma, modules). |
| `docs/features.md` | "Where does X live?" — every route, module, API group. |
| `docs/preferences.md` | Before any code — code style, what NOT to build, definition of done, git conventions. |
| `docs/sop/api-routes.md` | Adding/modifying API route. Most-referenced SOP. |
| `docs/sop/frontend.md` | Building page, wiring client component, editing sidebar. |
| `docs/sop/feature-flags.md` | Adding/gating feature flag. |
| `docs/sop/rbac.md` | Adding RBAC resource or changing permissions. |
| `docs/sop/data.md` | Editing Prisma schema, running seeds, writing tests. |
| `docs/sop/super-admin.md` | Building anything in `/super-admin` panel. |
| `docs/sop/qa-verification.md` | Before claim anything "done" — mandatory QA gate + bug-prevention checklist. |
| `docs/lessons-learned.md` | Real bugs shipped before + root cause + prevention rule (avoid repeat). |
| `PONYTAIL-DEBT.md` | See current shortcut ledger. Don't duplicate — regenerate with grep command in `docs/preferences.md`. |
| `DYNAMIC_FORMS.md` | Working with dynamic form schemas. |
| `docs/specs/` | Ship/change feature — read/write its PRD + acceptance criteria + relations map. Start from `docs/specs/_TEMPLATE.md`; e.g. `docs/specs/referral-program.md`. |

## Common file map (most-edited)

| File | What |
|---|---|
| `lib/auth.ts` | NextAuth config — jwt/session callbacks, providers, impersonation |
| `lib/prisma.ts` | PrismaClient singleton |
| `lib/feature-flags.ts` | `FLAG_KEYS`, `resolveAllFlags`, `resolveFlag` |
| `lib/require-feature-flag.ts` | `requireFeatureFlag`, `hasFeatureFlag` |
| `lib/permissions/definitions.ts` | RESOURCES, ACTIONS, RESOURCE_ACTIONS, RESOURCE_LABELS, `hasPermission` |
| `lib/permissions/check.ts` | `requireWithBranchOrThrow`, `requirePermissionOrThrow` |
| `lib/permissions/defaults.ts` | Default system roles (Owner / Manager / Kasir / Staff) |
| `lib/super-admin/permissions.ts` | `requireSuperAdminPanelSession`, `assertSuperAdminOrThrow` |
| `lib/audit.ts` | `auditLog(tx, input)` writer |
| `lib/i18n.ts` | `en` + `id` translations (~400 keys, flat dot-notation) |
| `modules/shared/` | Errors, http wrappers, logging, domain — `import { X } from "@/modules/shared"` |
| `components/layout/app-sidebar.tsx` | Tenant sidebar (4 buckets, flag + permission gated) |
| `components/layout/super-admin-sidebar.tsx` | Super-admin sidebar (3 groups) |
| `hooks/use-translation.ts`, `hooks/use-permissions.ts`, `hooks/use-feature-flag.ts` | Client hooks |
| `prisma/schema.prisma` | Schema (use `db:push`, not `migrate dev`) |
| `prisma/seed.ts`, `prisma/seed-flags.ts` | Seed scripts |
| `middleware.ts` | Edge middleware — subdomain routing, bearer→cookie rewrite |
| `instrumentation.ts` | Server boot — registers ErrorLog writer |

## Conventions summary

- **API envelope**: `{ success: true, data, meta? }` via `apiSuccess` / `apiCreated`. Errors via throw — never build error responses manual.
- **`ctx!.params`** in dynamic route handlers (typed optional by `withErrorHandler`).
- **Tenant + branch filter pattern**: `{ tenantId: ctx.tenantId, ...(ctx.isAllOutlets ? {} : { branchId: ctx.branchId }) }`.
- **Module selector**: tenant dashboard switch between `laundry` / `fnb` / `salon` via `MODULE_META`.
- **ALL-outlets mode**: `branchId === "ALL"` → sidebar hide module nav, API drop `branchId` filter.
- **Decimal serialization**: use `modules/shared/serialization` helpers. Don't `.toString()` ad-hoc.
- **i18n**: dot-notation keys (`section.entity.field`), no interpolation. Locale-aware dates via `toLocaleString(lang === "id" ? "id-ID" : "en-US")`.
- **`ponytail:`** comments mark every deliberate shortcut. Regenerate ledger:
  ```bash
  grep -rnE '(#|//) ?ponytail:' . \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
    --exclude-dir=coverage --exclude-dir=test-results
  ```

## Git conventions

- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- **Body focuses on WHY**, not what (diff shows what).
- **Co-author trailer** on AI-assisted commits: `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Branch naming**: `feat/<scope>`, `fix/<scope>`, `docs/<scope>`.
- **Never** commit `.env`, credentials, `coverage/`, `.next/`, `node_modules/`, `.playwright-mcp/`, `test-results/`.
- **Never** push without being asked. Never force-push to main. Never amend a pushed commit.

Full preferences + definition-of-done checklist: `docs/preferences.md`.