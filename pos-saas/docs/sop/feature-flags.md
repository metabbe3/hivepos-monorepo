# SOP: Feature Flags

Every tenant-visible feature ships behind a flag. This is the single-source lifecycle.

## Resolution rule

```
resolved = override?.enabled ?? flag.enabled
```

| Global | Override | Result | Meaning |
|---|---|---|---|
| ON | — | ON | Default for everyone |
| OFF | `enabled: true` | ON | Beta whitelist |
| ON | `enabled: false` | OFF | Blacklist (kill-switch for one tenant) |
| OFF | — | OFF | Off for everyone |

**Unknown flag key → `true`** (permissive). A missing seed never hides a feature.

## Where flags live

- **DB**: `FeatureFlag` (catalog, global `enabled`) + `TenantFeatureFlag` (per-tenant `override.enabled`).
- **JWT**: resolved once at login → `session.user.featureFlags: Record<string, boolean>`. This is what the runtime reads — no DB hit per request.
- **Source of truth for keys**: `FLAG_KEYS` in `lib/feature-flags.ts:39`.

## Add a new flag (5 steps)

1. **Add the key** to `FLAG_KEYS` in `lib/feature-flags.ts`:
   ```typescript
   export const FLAG_KEYS = [
     // ...
     "commission",
   ] as const;
   ```

2. **Add a seed entry** in `prisma/seed-flags.ts`:
   ```typescript
   { key: "commission", name: "Commission Tracking", category: "operations" },
   ```

3. **Run the seed**:
   ```bash
   npx tsx prisma/seed-flags.ts
   ```
   Idempotent upsert — updates name/category on re-run, never resets `enabled` (so super-admin toggles survive).

4. **Gate the API** (`lib/require-feature-flag.ts`):
   ```typescript
   import { requireFeatureFlag } from "@/lib/require-feature-flag";

   export const POST = withErrorHandler(async (req) => {
     const ctx = await requireWithBranchOrThrow("orders", "create");
     requireFeatureFlag("commission", ctx.session); // throws ForbiddenError if off
     // ...
   });
   ```
   Super-admin bypasses automatically.

5. **Gate the UI** — pick one:
   - Sidebar entry: add `flag: "commission"` to the `NavItem`.
   - Inline component: `const enabled = useFeatureFlag("commission");`

## Flag categories

Used for grouping in the super-admin UI (`/super-admin/feature-flags`).

| Category | Examples |
|---|---|
| `general` | dashboard, tickets |
| `operations` | orders, customers, services, inventory, expenses, deposits, pickupRequests, reports |
| `admin` | branches, users, roles, billing |
| `growth` | website |

## Freshness

- Flags are cached in the JWT at login (3 resolution paths in `lib/auth.ts` jwt callback — see `docs/architecture.md`).
- **Refresh triggers**: re-login, or `sessionVersion` bump (e.g. when super-admin edits a tenant's override, bump that tenant's users' sessionVersion to force re-resolution).
- No polling, no WebSocket. Stale flags within one session are accepted.

## Per-tenant overrides

Managed at `/super-admin/feature-flags/[id]` (super-admin only). UI supports:

- **Whitelist**: global OFF + tenant override `enabled: true` (beta rollout).
- **Blacklist**: global ON + tenant override `enabled: false` (kill-switch).
- **Reason** field — why the override exists (surfaced in the UI).
- **Filter** by `overrideOnly` to see only flags with overrides.

## Hooks reference

```typescript
import { useFeatureFlag, useFeatureFlags } from "@/hooks/use-feature-flag";

const enabled = useFeatureFlag("inventory");         // single, defaults true
const flags = useFeatureFlags();                      // Record<string, boolean>
```

```typescript
import { requireFeatureFlag, hasFeatureFlag } from "@/lib/require-feature-flag";

requireFeatureFlag("inventory", session);             // throws
if (hasFeatureFlag("inventory", session)) { ... }     // boolean
```

## Definition of done for a new flag

- [ ] Key in `FLAG_KEYS` (`lib/feature-flags.ts`)
- [ ] Seed entry in `prisma/seed-flags.ts`
- [ ] Seed run
- [ ] API guard on every route that exposes the feature
- [ ] Sidebar entry has `flag:` set (if a nav item)
- [ ] Translation keys for any new UI labels (both `en` and `id`)
