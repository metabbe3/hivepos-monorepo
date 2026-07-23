# hivePOS — Monorepo

hivePOS laundry SaaS. One git repo (this root) holds three app subdirs that share one Postgres + one API contract.

**Single repo:** this `hivepos/` root is the only git repo (remote `metabbe3/hivepos-monorepo`). `hivepos-api/`, `hivepos-web/`, `pos-saas/` are **subpaths**, not separate repos — their histories were merged in (preserved). Branch + commit at the root.

## Repos (subdirs)

| Subdir | Stack | Role | Port |
|---|---|---|---|
| `hivepos-api` | Go 1.25, chi, pgx, JWT, bcrypt | Backend (REST API) | :8099 |
| `hivepos-web` | Next.js 16, React 19, TS, Tailwind 4 | Frontend (App Router) | :3008 |
| `pos-saas` | Next.js 16, Prisma, NextAuth | Legacy fullstack (reference only — being replaced) | :3007 |

**Shared DB:** `postgresql://posadmin:poslocal@localhost:5437/pos_saas` (Docker `pos-saas-db-1`).

## Quick start

```bash
# Backend (loads .env via godotenv)
cd hivepos-api && go run cmd/server/main.go   # :8099

# Frontend (hot-reloads)
cd hivepos-web && npm run dev -- -p 3008      # :3008
```

Each repo has its own `CLAUDE.md` with detailed conventions + non-negotiables. Read those first.

## RAG code navigation (reduces token cost vs grep)

Both repos ship a structural codebase index. **Query the RAG before grepping** — it returns the exact symbol + file:line + callers in one call:

```bash
# Backend (Go)
cd hivepos-api && go run scripts/codebase-rag.go query "checkout"
cd hivepos-api && go run scripts/codebase-rag.go symbol Checkout
cd hivepos-api && go run scripts/codebase-rag.go callers CreatePayment
cd hivepos-api && go run scripts/codebase-rag.go index   # rebuild after changes

# Frontend (TS)
cd hivepos-web && npx tsx scripts/codebase-rag.ts query "apiFetch"
cd hivepos-web && npx tsx scripts/codebase-rag.ts symbol handleCheckout
cd hivepos-web && npx tsx scripts/codebase-rag.ts index
```

Re-index after structural changes. The index lives in `.codebase-rag/index.json` (gitignored).

## Symbol navigation

- **Prefer the LSP tool** (`goToDefinition`, `findReferences`, `hover`, `documentSymbol`, `workspaceSymbol`) over grep for any symbol lookup, call-graph walk, or "where is X used" question. It is exact and type-aware.
- **grep is for literal text only** — error strings, log lines, config keys, string literals. Not for symbol resolution.
- **Trust the language server's results.** Do not re-read files to "confirm" what LSP returned — that burns tokens and re-derives what the server already gave you. Act on it. Only re-read if the result is ambiguous or clearly stale.

## Git workflow

- **One branch per goal/feature.** Before starting non-trivial work, branch off `main` (e.g. `feat/<thing>`, `fix/<thing>`).
- **Merge to `main` only after everything works** — build passes, feature verified, no regressions. Don't merge broken WIP.
- Small trivial fixes (typo, one-liner) can land directly on `main`.

## Feature workflow — contract first, parallel agents

**Automated by the `/feature` skill** (`.claude/skills/hivepos-feature/SKILL.md`) — invoke it for any feature touching **both** `hivepos-api` and `hivepos-web`. It enforces branch-per-feature, contract-PRD first, parallel isolated BE+FE, and merge-only-when-green. Specialized agents live in `.claude/agents/`: `hivepos-contract`, `hivepos-backend`, `hivepos-frontend`. For debugging, `/debug` (`.claude/skills/hivepos-debug/`) checks known pitfalls first, then locates source via `codebase-rag debug`/`symbol`/`callers`/`callees` + LSP — token-cheap. Manual steps if not using the skill:

For any feature touching **both** `hivepos-api` and `hivepos-web`:

1. **Branch + contract first.** `git checkout -b feat/<domain>-<thing>` off `main`. Add/update the endpoint(s) in `hivepos-web/contracts/openapi.yaml` (single source of truth — see `hivepos-web/CLAUDE.md`; for batch backfill write a `contracts/_staging/<domain>.yaml` fragment + `npx tsx scripts/merge-contracts.ts`), then `npm run gen:contract` (regenerates `lib/api/types.ts` + `docs/contracts/*.md`). Commit the contract on the branch **before** any BE/FE feature code.
2. **Dispatch the backend + frontend agents in parallel**, each branched off `main` and run in an isolated **worktree** (`isolation: "worktree"`) so builds/tests don't collide:
   - **`hivepos-backend`** → implements the Go route(s) in `hivepos-api` against the contract: correct response envelope, exact field names. Verify by `curl` + JSON-key check + `go vet/test/build`.
   - **`hivepos-frontend`** → consumes the regenerated types in `hivepos-web`, wires `apiFetch`. No hand-written response shapes. Verify `tsc/build/test`.
   - Both read `contracts/openapi.yaml` as the shared spec — neither invents fields.
3. **Merge only when green.** Both gates (BE curl+vet/test/build, FE tsc/build/test + contract round-trip) + a manual/browser verify on the changed path. Then squash-merge to `main`, delete the branch.

## Modes (global plugins — active across all repos)

- **Caveman** (`/caveman`): terse output (~65% fewer tokens). Drop articles/filler.
- **Ponytail** (`/ponytail`): lazy senior dev (~54% less code via YAGNI). Shortest diff wins.
- Toggle: `/caveman full|lite`, `/ponytail full|lite`. Off: "stop caveman" / "stop ponytail".

## Key lessons (full detail in each repo's `docs/lessons-learned.md`)

- **apiFetch dedup**: FE paths may include `/api/`; the client normalizes (don't churn 58 call sites).
- **Response shapes**: Go list endpoints return bare arrays (not `{key:[]}` wrappers like legacy); `writeRows` endpoints return `{rows,page,hasNext}`.
- **FE↔BE field names**: must match exactly (e.g., `snapToken` not `token`) — verify by clicking the button, not just reading code.
- **Never hardcode prices**: read from the Plan table (`priceMonthly`), not literals.
- **`.env` loads via godotenv** (Go config reads .env + OS env).
- **Server components + client stubs = crash**: convert to client components that use `apiFetch`.
- **Transient fetch failure ≠ logout**: `reloadSession` clears the token only on a real 401/403 — never on an abort/429/5xx/network blip (else a valid session logs out on a navigation abort). See `hivepos-web/docs/lessons-learned.md` #11.
- **Service-worker cache must version per build**: `hivepos-web/scripts/gen-sw-version.mjs` injects a build-unique `VERSION` into `public/sw.js` in `prebuild`. A constant `VERSION` = redeployed fixes never reach the browser (stale chunks). See `hivepos-web/docs/lessons-learned.md` #12.

## Env vars (keys copied from legacy pos-saas/.env)

- **Midtrans**: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_ENV` (api) + `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `NEXT_PUBLIC_MIDTRANS_ENV` (web).
- **Google OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (api) + `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` (web).
- **AI assistant** (optional): `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` (api — OpenAI-compatible).
