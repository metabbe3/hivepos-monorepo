# CLAUDE.md

hivePOS **frontend** — Next.js UI consuming the Go backend (`hivepos-api`).
Next.js 16 App Router, React 19, Tailwind 4, Vitest, Playwright. Bilingual (`en` + `id`).
Dev port **3007**. This repo has **no database, no API routes, no server-side auth** — all data
comes from `hivepos-api` via the typed contract. (Legacy `pos-saas` is the fullstack app this is
being split out of; during the transition, `API_BASE_URL` can point at either backend since both
share the same response envelope + DTO shapes.)

## Quick start

```bash
npm install
npm run gen:contract   # regen lib/api/types.ts + docs/contracts/*.md from openapi.yaml
npm run dev            # http://localhost:3007 (needs a backend — see below)
```

The app needs a backend on `/api`. Local options:
- **Behind Caddy (recommended):** `docker compose up` → Caddy routes `/api/*`→Go:8080, `/`→web.
- **Direct to Go (no Caddy):** run hivepos-api on :8080, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api`.

Test/verify before ship:
```bash
npx tsc --noEmit       # 0 errors
npm run build          # standalone build (regenerates contract in prebuild)
npm test               # vitest
```

> **Feature work? Spec first** — write/update `docs/specs/<feature>.md` (from `_TEMPLATE.md`,
> Given/When/Then) **before** code. See Non-negotiable #7.

> **Navigation: RAG-first** — before grep/Read to *locate* code:
> `npx tsx scripts/codebase-rag.ts query "<term>"` (fuzzy), `symbol <Name>` (exact),
> `callers <Name>` / `callees <Name>` (call graph), `debug "<text>"` (find the
> source of an error/log/i18n string — token-cheap). Re-index after changes (`npm run rag:index`).
> For debugging, the `/debug` skill checks known pitfalls first, then RAG/LSP.
> For features touching both repos, the `/feature` skill runs the contract-first
> flow (branch → contract-PRD → parallel BE+FE agents → merge-when-green).

## Stack at a glance

| Tech | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | App Router, frontend mode (standalone output). No API routes. |
| React | 19.2.3 | UI runtime |
| TypeScript | 5.7.0 | Strict, `@/*` path alias |
| Tailwind | 4.1.0 | `@tailwindcss/postcss` |
| openapi-typescript | ^7 | Generates `lib/api/types.ts` from `contracts/openapi.yaml` |
| Vitest | 4.1.9 | Unit tests |
| Playwright | 1.60.0 | E2E |
| Zod | ^4.3.6 | Form/input validation |

## Architecture in one paragraph

`contracts/openapi.yaml` is the **single source of truth** for the API. `npm run gen:contract`
generates typed request/response shapes (`lib/api/types.ts`) + agent-readable per-domain docs
(`docs/contracts/*.md`). `lib/api/client.ts` (`apiFetch`) is the only HTTP entrypoint — envelope-aware,
cookie-auth (`credentials: "include"`), base = `NEXT_PUBLIC_API_BASE_URL` (default `/api` via Caddy).
Components call `apiFetch<T>("/...")` with types from `lib/api/types`. Auth = JWT in an httpOnly
cookie set by the backend; same-origin (Caddy) so no CORS.

## Non-negotiables

1. **Every API call goes through `apiFetch`** (`lib/api/client.ts`). Never raw `fetch` — you lose
   envelope handling + the typed contract. Import the response type from `lib/api/types`.
2. **Every endpoint exists in `contracts/openapi.yaml` before you call it.** Add it → run
   `npm run gen:contract` → commit the regenerated `types.ts` + `docs/contracts/*.md`. CI fails on drift.
3. **No database, no Prisma, no server-only business logic in this repo.** If you reach for one,
   that work belongs in `hivepos-api`. This repo is presentation + client state only.
4. **Every user-facing string go through `t("key")`** with entries in **both** `en` + `id` in
   `lib/i18n.ts`. No interpolation — manual `.replace("{name}", value)`.
5. **Mark deliberate shortcuts** with `// ponytail: <ceiling> — <upgrade path>`. Regenerate `PONYTAIL-DEBT.md`.
6. **Every change pass QA gate** (`docs/sop/qa-verification.md`): root-cause → minimal fix →
   `tsc` → `build` → `test` → dedicated review (`code-review`) → manual/browser verify on changed path.
7. **Spec-first for features.** Before code for a new feature or material behavior change, create
   (or update) `docs/specs/<feature>.md` from `docs/specs/_TEMPLATE.md` — incl. Given/When/Then
   acceptance criteria + relations-to-other-functions map. Exempt: bug fixes, typos, pure refactors.
8. **`apiFetch` normalizes `/api` prefix** — paths may include `/api/...`; the client strips a
   duplicate prefix. Don't churn 58 call sites. See `docs/lessons-learned.md` #1.
9. **Go list endpoints return bare arrays** (`apiFetch<T[]>(url)` → `r.data`). Some endpoints use
   `writeRows` → `{rows, page, hasNext}` — read `r.data.rows`. See `docs/lessons-learned.md` #2-3.
10. **Server components must not call `apiFetch` or client-only stubs.** `apiFetch` reads
    `localStorage` for the JWT → unavailable during SSR → crash. Convert to `"use client"` + `useEffect`.
    See `docs/lessons-learned.md` #4.
11. **Session/role-driven pages need a `mounted` guard.** `useSession()` leaks across SSR requests →
    hydration mismatch. Pattern: `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []); if (!mounted) return <loadingShell/>`. See `docs/lessons-learned.md` #5.
12. **`router.refresh()` does NOT update `useState`.** After a mutation on a client-component page,
    call a reload callback (`onMutated`), not `router.refresh()`. See `docs/lessons-learned.md` #6.
13. **`reloadSession` may only clear the token on a real 401/403.** A transient `/auth/me` failure
    (navigation abort, 429, 5xx, network) must leave the token + session intact — otherwise a valid
    session is logged out by a blip (the orders-page redirect loop). See `docs/lessons-learned.md` #11.
14. **The service worker cache is versioned per build — never hand-edit `VERSION` in `public/sw.js`.**
    `scripts/gen-sw-version.mjs` (run in `prebuild`) injects a build-unique `VERSION` so each deploy
    busts the SW cache. A constant `VERSION` = redeployed fixes never reach installed browsers (stale
    chunks served). If a fix is in the build but the browser doesn't see it, unregister the SW +
    clear `caches`. See `docs/lessons-learned.md` #12.

## Conventions summary

- **API envelope**: `{ success: true, data, meta? }` / `{ success: false, error: { code?, message } }`.
  `apiFetch` unwraps → `{ data, meta? }` or throws `ApiClientError`.
- **Contract**: edit `contracts/openapi.yaml` → `npm run gen:contract`. Generated: `lib/api/types.ts`
  (committed), `docs/contracts/*.md` (committed). Drift caught by CI (`gen:contract:check`).
- **Backend swap**: `NEXT_PUBLIC_API_BASE_URL` → Go (prod) or pos-saas (transition). Same client works
  against either — both share envelope + shapes.
- **i18n**: dot-notation keys, no interpolation. Locale-aware dates via `toLocaleString(lang === "id" ? "id-ID" : "en-US")`.
- **`ponytail:`** comments mark every deliberate shortcut. Regenerate ledger: `npm run ponytail`.

## Brand voice & positioning

**One-liner**: Kasir laundry ringan di browser, untuk UMKM Indonesia.
**Primary slogan**: "Kasir laundry, tinggal buka browser."

- Bahasa Indonesia, casual-professional. "Anda" for CTAs.
- No buzzwords. Concrete > abstract ("2 menit", "Rp 49K/outlet").
- UMKM-friendly. Anti-bloat: "tanpa ribet", "tanpa install". Never name competitors.

## Doc map

| File | Read when… |
|---|---|
| `contracts/openapi.yaml` | Adding/changing any API endpoint (source of truth). |
| `docs/contracts/*.md` | "What endpoints exist / what do they return?" (generated). |
| `docs/contracts/BACKFILL.md` | Contract coverage ledger (domain × endpoints). |
| `docs/sop/contract.md` | How the OpenAPI → types → MD pipeline works. |
| `docs/sop/contract-first-feature.md` | Contract-first feature flow (→ `/feature` skill). |
| `docs/sop/api-client.md` | How to call the API (`apiFetch`), auth, errors. |
| `docs/sop/codebase-rag.md` | RAG navigation usage. |
| `docs/sop/frontend.md` | Server/client component patterns. |
| `docs/sop/qa-verification.md` | Before claiming anything "done". |
| `docs/lessons-learned.md` | Before claiming "done" — bugs shipped + prevention rules. |
| `docs/preferences.md` | Code style, YAGNI, definition of done, git conventions. |
| `docs/deploy.md` | Docker / Caddy / CI deploy. |
| `docs/specs/` | Feature PRDs + acceptance criteria. Start from `_TEMPLATE.md`. |
| `PONYTAIL-DEBT.md` | Shortcut ledger (migration stubs + inherited). |
| `PORT-DEBT.md` | Migration ledger — unwired pages (W2), Go endpoint gaps, stub modules. **Update as pages wire / Go endpoints land.** |

## Git conventions

- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- Body focuses on WHY. `Co-Authored-By: Claude <noreply@anthropic.com>` on AI-assisted commits.
- Branch naming: `feat/<scope>`, `fix/<scope>`. Never push without being asked. Never force-push to main.
- When `contracts/openapi.yaml` changes, the regenerated `types.ts` + `docs/contracts/*` go in the
  **same commit** — keeps the contract + its artifacts in lockstep.
