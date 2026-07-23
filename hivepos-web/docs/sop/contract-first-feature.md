# Contract-first feature SOP

Automated by the **`/feature`** skill (`.claude/skills/hivepos-feature/SKILL.md`).
This doc is the human-readable reference for the same flow.

## Why
The OpenAPI contract (`contracts/openapi.yaml`) is the single source of truth
binding `hivepos-api` (Go) and `hivepos-web` (TS). Building contract-first — both
sides bind to generated types — eliminates the cascading breakage caused by
hand-written FE types diverging from the backend (e.g. `snapToken` vs `token`
shipping as a runtime bug instead of a type error).

## Flow
1. **Branch** off `main`: `git checkout -b feat/<domain>-<thing>`.
2. **Contract-PRD first.** Add/update endpoints in `contracts/openapi.yaml` →
   `npm run gen:contract` (regenerates `lib/api/types.ts` + `docs/contracts/*.md`).
   Commit the contract before any feature code.
3. **Parallel BE + FE in isolated worktrees** (so builds/tests don't collide):
   - `hivepos-backend` implements the Go route against the contract; verifies
     `curl` JSON keys + `go vet/test/build`.
   - `hivepos-frontend` consumes the generated types via `apiFetch`; verifies
     `tsc/build/test` + browser.
4. **Merge only when green** (both gates + manual verify), squash to `main`.

## Backfilling an existing endpoint/domain
The contract covers all registered routes (see `docs/contracts/BACKFILL.md`).
For a new domain, author a fragment `contracts/_staging/<domain>.yaml` (paths +
`components` schemas/responses/parameters), then merge:
```bash
npx tsx scripts/merge-contracts.ts   # deep-merges _staging/*.yaml → openapi.yaml
npm run gen:contract                 # regen types + docs
```
`_staging/` is gitignored (transient). `merge-contracts.ts` errors on
path/method collisions and reports duplicate schema names (first-writer-wins for
shared helpers like `EnvelopeSuccess`).

## Verify
`npm run gen:contract:check` (CI drift guard) + `npx tsc --noEmit` must be clean.
