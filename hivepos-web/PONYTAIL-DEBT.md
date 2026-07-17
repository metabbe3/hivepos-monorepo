# PONYTAIL-DEBT — hivepos-web shortcut ledger

Full list: `npm run ponytail`
(`grep -rnE '(#|//) ?ponytail:' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=coverage --exclude-dir=test-results --exclude-dir=.codebase-rag`)

Two kinds of shortcuts live here:
1. **Migration stubs** (this file, below) — compile-only stand-ins added while porting off pos-saas.
   Each maps to a `PORT-DEBT.md` item. Delete/convert as the port completes.
2. **Inherited pos-saas design shortcuts** (~120 comments in app/components/hooks/lib copied
   verbatim) — the app's own intentional ceilings (debounce, caches, hand-rolled CSV/WebVitals,
   localStorage state, etc.). Not re-listed; see `npm run ponytail`.

## Migration stubs (delete as PORT-DEBT clears)

| File:line | Ceiling | Upgrade path |
|---|---|---|
| `lib/prisma.ts:1` | frontend has no DB; safe-empty Proxy for 10 server pages | convert pages → apiFetch (PORT-DEBT §1), then delete |
| `lib/auth.ts:1` | NextAuth `auth()` stub returns null | remove once support page uses client session |
| `lib/auth-client.tsx:45` | merges Go `/me` user+claims into pos-saas session shape (leaner) | extend Go `/me` to return full claims; drop merge |
| `lib/auth-client.tsx:66` | `signIn` opts typed `any` | tighten once call sites audited |
| `lib/auth-client.tsx:71` | Google OAuth redirects to Go stub `/api/auth/google` | wire real Go Google flow |
| `lib/auth-client.tsx:99` | `useSession().data` is `any` | tighten to a real Session type once fields stable |
| `lib/billing.ts:1` | billing consts/types as stubs | Go owns billing; pages use `/api/billing/*` |
| `lib/super-admin/permissions.ts:1` | `requireSuperAdminPanelSession` no-op | client gate on JWT claims; super-admin → `/api/super-admin/*` |
| `lib/{telemetry,tickets,tenant-cache,pickup-insights,audit-query,error-logs,tickets-admin,tenant-performance,user-admin,billing-analytics}.ts:1` | server query helpers → empty | super-admin pages → Go endpoints (PORT-DEBT §1) |
| `lib/get-session.ts`, `lib/feature-flags.ts` | server session/flag type stubs | derive from JWT claims client-side |
| `lib/error-log-writer.ts:1` | DB error logging no-op | backend owns |
| `app/generated/prisma/{client,enums}.ts:1` | `Prisma`/`PrismaClient` = any; enums re-exported | drop once DTOs stop importing; delete |
| `modules/shared/http/index.ts` | `api-handler` (next/server) excluded from client barrel | keep excluded; server imports it directly if ever needed |
| `lib/api/token.ts:1` | JWT in localStorage (readable by JS) | move to httpOnly cookie via a thin Next BFF `/auth` route |
| `contracts/openapi.yaml:10` | spec owned in web repo | relocate to hivepos-api once it emits OpenAPI |
| `.env.example:10` | SSR fetch base not wired | add `API_BASE_URL_SSR` + container DNS when SSR data fetch lands |
| `.github/workflows/ci.yml:36` | GHCR push + deploy not wired | fill registry + SSH/watchtower steps |
| `docs/deploy.md:27` | deploy target not pinned | wire to actual host |
| `vitest.config.ts:9` | node env (no jsdom) | add jsdom when first component test lands |
| `scripts/codebase-rag.ts:327` | lexical BM25, no semantic retrieval | embeddings if recall misses |
| `scripts/gen-contract.ts` | hand-rolled MD emitter | redocly/widdershins if richer rendering needed |

Migration progress + page-level debt: see **[PORT-DEBT.md](./PORT-DEBT.md)**.
