# hivepos-web

Next.js frontend for **hivePOS** — kasir laundry ringan di browser. Consumes the Go backend
([`hivepos-api`](../hivepos-api)). Split out of the legacy fullstack `pos-saas` app.

This repo has **no database / no API routes / no server-side auth**. All data flows through the
typed contract → `apiFetch` → backend.

## Quick start

```bash
npm install
npm run gen:contract   # types.ts + docs/contracts/*.md from contracts/openapi.yaml
npm run dev            # http://localhost:3007
```

The app needs a backend on `/api`. Two ways to run locally:

**A) Docker Compose (Caddy edge + Go + Postgres):**
```bash
docker compose up --build   # Caddy :80 → /api to Go, / to web
# open http://localhost
```

**B) Direct to a running hivepos-api:**
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api npm run dev
```

## Contract

`contracts/openapi.yaml` is the source of truth. Edit it, then `npm run gen:contract`.
CI fails if generated `lib/api/types.ts` or `docs/contracts/*.md` drift. See
[`docs/sop/contract.md`](docs/sop/contract.md).

## Backend swap (transition)

`NEXT_PUBLIC_API_BASE_URL` works against either backend — `hivepos-api` (Go) or legacy `pos-saas`,
since both share the response envelope + DTO shapes. Point at Go for ported domains, pos-saas for
the rest during the migration.

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Next dev on :3007 |
| `npm run build` | standalone build (regenerates contract in `prebuild`) |
| `npm run gen:contract` | openapi → `lib/api/types.ts` + `docs/contracts/*.md` |
| `npm run gen:contract:check` | drift guard (CI) |
| `npm test` | vitest |
| `npm run rag:index` / `rag:query` | codebase RAG navigation |
| `npm run ponytail` | regen shortcut ledger |

See [`CLAUDE.md`](CLAUDE.md) for conventions + [`docs/`](docs/) for SOPs.
