# SOP: Codebase RAG — query before you scan

The codebase has a **structural index** (`scripts/codebase-rag.ts`) that maps
every function/class/component/route/type/hook to its exact location, signature,
summary, and who references it. **Query it FIRST** — one cheap CLI call replaces
the grep/Read thrash that burns tokens.

## When to use it

Before **any** task that needs to find or understand code: a `/goal`, an
`/impeccable` critique/audit/polish, a bug fix, a feature, a refactor. Query the
RAG **before** you grep / glob / Read.

## The workflow (RAG-first)

1. **Query the RAG** for the symbols involved:
   ```bash
   npx tsx scripts/codebase-rag.ts query "<term>"      # BM25 + re-rank → top hits
                                                       # with file:line + signature + summary
                                                       # + caller/callee mini-trace
   npx tsx scripts/codebase-rag.ts symbol <ExactName>  # exact-name lookup
   npx tsx scripts/codebase-rag.ts callers <name>      # who references it (approx, ←)
   npx tsx scripts/codebase-rag.ts callees <name>      # what it references (approx, →)
   npx tsx scripts/codebase-rag.ts stats               # index coverage
   ```
2. **Read only what the RAG surfaces** — the specific `file:line` ranges it
   returns, not whole files.
3. **Fall back to scanning ONLY if the RAG doesn't cover it:**
   - a brand-new file not yet indexed,
   - a non-TS asset (Prisma schema, CSS, the one Python script),
   - the approximate `called_by` misses a DI/module-wired reference.
   Then `grep`/`glob`/`Read`.
4. **Re-index after code changes** so the RAG stays current:
   ```bash
   npx tsx scripts/codebase-rag.ts index   # SHA-256 delta sync — only changed
                                           # files re-parse; seconds, no LLM cost
   ```

## Build / maintain the index

- First run, or after pulling: `npx tsx scripts/codebase-rag.ts index`.
- Index lives in `.codebase-rag/` (**gitignored** — it's regenerable; CI rebuilds
  it on every push to `main` and uploads the artifact).
- Extraction is deterministic (TypeScript compiler API — no LLM). Summaries are
  JSDoc + signature (no LLM). See `docs/specs/codebase-rag.md`.

## Why (token cost)

A `query` returns the 5–10 exact symbols you need with their locations in **one**
call. The alternative — grep, open files, scroll to find the function — is 5–20
`Read` calls per question. At 686 files / 2,171 symbols, RAG-first cuts
navigation tokens by roughly an order of magnitude.

## Retrieval model (no LLM, no embeddings)

`query` is a **two-stage lexical pipeline** — deterministic, zero model cost:

1. **BM25 recall** (top 25): scores every symbol's weighted token "document"
   (name subtokens weigh highest, then summary, then signature/kind/params/path).
   Identifiers are split on camelCase / snake_case / kebab / punctuation, so
   exact-string queries like `is_active_v2` or `ERR_AUTH_501` land the defining
   symbol rather than a conceptually-similar one. IDF dampens common tokens.
2. **Lexical re-rank** (top `k`): re-scores the 25 by query↔symbol joint signal
   (exact name > prefix > token overlap > summary phrase). BM25 breaks ties.

Each result prints a **mini execution trace** — `← callers` (who references it)
and `→ callees` (what it references), top 3 each — so you see the symbol in its
call context (Route → Handler → DB call), not as a floating function.
`callers`/`callees` give the full lists. Edges are name-token based → **approx**
(DI/module-wired refs may be under-counted; generic names like `Icon` add noise).

> **Deferred:** a semantic/vector layer (pgvector + embeddings) is intentionally
> NOT built. Add it only if the index grows past ~10k symbols or lexical recall
> proves insufficient. See `docs/specs/codebase-rag.md`.

## Rules

- **RAG-first is the default.** Don't grep/Read to *locate* symbols the RAG can
  find. Use scanning for *understanding* the specific code the RAG surfaced, or
  when the RAG genuinely doesn't cover it.
- If the RAG is empty/stale (`.codebase-rag/` missing), run `index` once, then
  proceed RAG-first.
- After a non-trivial code change, `index` so the next query is accurate.

## CI workflow (create manually)

A security hook blocks auto-writing `.github/workflows/*.yml` (forces human
review for injection risks). This workflow uses **no untrusted `github.event`
input** — it's safe. Create `.github/workflows/codebase-rag.yml` with:

```yaml
name: codebase-rag index
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx tsx scripts/codebase-rag.ts index
      - uses: actions/upload-artifact@v4
        with:
          name: codebase-rag-index
          path: .codebase-rag/index.json
          retention-days: 30
```

It rebuilds the index on every push to `main` and uploads it as an artifact —
the team + future agents download a current index instead of re-indexing.

