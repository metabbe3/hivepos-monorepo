# SOP: Data Layer (Prisma + Seeds + Testing)

## Prisma workflow

| Command | Purpose |
|---|---|
| `npm run db:push` | Apply schema changes directly to DB (no migration files) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio GUI |
| `npx tsx prisma/seed-flags.ts` | Idempotent flag upsert |
| `npx tsx scripts/seed-rbac.ts` | RBAC backfill for existing tenants |
| `npx tsx scripts/seed-super-admin.ts` | Create super-admin user |
| `npx tsx scripts/seed-billing.ts` | Backfill billing state |

**No `migrations/` folder.** This project uses `db push`, not `migrate dev`. Schema state lives in `prisma/schema.prisma` + the DB.

After editing `schema.prisma`:
```bash
npm run db:push     # apply to DB
# client is regenerated automatically by postinstall / next build
```

Additive changes (new model, new column) are safe. Destructive changes (rename, drop) — `db push` will prompt for confirmation.

## Schema conventions

### Tenant-scoped models

Every tenant-scoped model follows this shape:

```prisma
model Order {
  id        String   @id @default(uuid())
  tenantId  String
  branchId  String
  // ...domain fields...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])
  branch Branch @relation(fields: [branchId], references: [id])

  @@index([tenantId])
  @@index([tenantId, branchId])
}
```

- UUIDs for all ids (`@default(uuid())`)
- `tenantId` ALWAYS present + `@@index([tenantId])`
- `branchId` when the entity belongs to a specific outlet
- `createdAt` + `updatedAt` standard
- Decimal for money fields (`@db.Decimal(12, 2)`)

### Decimal serialization

Use `modules/shared/serialization` helpers when returning Decimal via API — JSON.parse chokes on Decimal instances. Don't `.toString()` ad-hoc.

## Client singleton

`lib/prisma.ts` exports a singleton PrismaClient with the `@prisma/adapter-pg` driver:

```typescript
import { prisma } from "@/lib/prisma";

const orders = await prisma.order.findMany({ ... });
```

Never instantiate `new PrismaClient()` in app code — it exhausts the connection pool under load.

## Add a new model (4 steps)

1. **Add to `prisma/schema.prisma`** with the conventions above (tenantId, indexes, relations).
2. **Run `npm run db:push`** — applies to DB + regenerates the client.
3. **Add seed logic** if the model needs demo data (in `prisma/seed.ts`).
4. **Add a feature flag + RBAC resource** if the model ships with a new feature (see relevant SOPs).

## Seed scripts

### `prisma/seed.ts` — full demo data
- Plans (Free / Growth / Pro)
- One demo tenant + Owner user + branch
- Services + service groups
- 4 default roles via `seedDefaultRoles()`
- Super-admin user
- Run: `npm run db:seed`

### `prisma/seed-flags.ts` — idempotent flag upsert
- Updates name/category on re-run
- Never resets `enabled` (preserves super-admin toggles)
- 15 flags seeded across 4 categories
- Run: `npx tsx prisma/seed-flags.ts`

### `lib/permissions/seed.ts` — RBAC
- `seedDefaultRoles(tx, tenantId)` — creates the 4 system roles
- `backfillUserRoles(tx, tenantId, roleMap)` — links legacy users to roles
- Called from registration, seed.ts, and `scripts/seed-rbac.ts`

### `scripts/` — one-off backfills
- `seed-billing.ts` — backfill subscription state
- `seed-rbac.ts` — backfill RBAC roles for existing tenants
- `seed-super-admin.ts` — create super-admin
- `backfill-coverage.ts` — extend outlet coverage windows
- `backfill-order-numbers.ts` — fill missing order numbers
- `backfill-paid-outlets.ts` — mark paid outlets
- `migrate-from-laundry.ts`, `migrate-per-outlet.ts` — historical migrations
- `patch-pickup-slug.ts` — backfill branch slugs for pickup URLs
- `enable-fnb-demo.ts` — enable F&B for demo tenant

## Testing

### Vitest (unit)
- Config: `vitest.config.ts`
- Setup: `lib/test/setup.tsx`
- Pattern: tests live next to source (`foo.ts` → `foo.test.ts`)
- Coverage threshold: 80%
- Commands:
  ```bash
  npm test                 # run once
  npm run test:watch       # watch mode
  npm run test:coverage    # coverage report
  ```

### Playwright (E2E)
- Config: `playwright.config.ts`
- testDir: `./e2e`
- baseURL: `http://localhost:3007`
- Auto-starts dev server
- Retries: 1
- Run: `npx playwright test`

### What to test

- **Non-trivial logic** (branch, loop, parser, money/security path) — leave ONE runnable check. Smallest thing that fails if logic breaks.
- **Trivial getters/setters/render calls** — no test. YAGNI applies to tests.
- **API routes** — test the handler function with a mocked `prisma` if logic is non-trivial. Don't test the framework wrappers.
- **React components** — test rendering for logic-bearing components (filters, conditional UI). Skip pure layout.

## Type augmentation

- `types/next-auth.d.ts` — augments NextAuth JWT + Session with `tenantId`, `branchId`, `permissions`, `featureFlags`, etc. Required for TS to know about custom claims.

## Definition of done for a new model

- [ ] Schema has `tenantId` + `@@index([tenantId])`
- [ ] UUID id, `createdAt`, `updatedAt`
- [ ] `db:push` succeeded
- [ ] Client regenerated (`npm run build` or `npx prisma generate`)
- [ ] Decimal fields use `@db.Decimal(12, 2)`
- [ ] All tenant-scoped queries filter by `tenantId` from session (never client input)
- [ ] Seed entry added if needed
- [ ] Non-trivial logic has ONE runnable check
