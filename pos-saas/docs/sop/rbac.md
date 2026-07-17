# SOP: RBAC (Roles & Permissions)

Permission model used everywhere in hivePOS. Read this before adding a new resource or gating UI.

## Resource + action model

Permissions are strings: `{resource}:{action}` (e.g. `orders:create`, `customers:read`).

- **13 resources**: `dashboard`, `orders`, `customers`, `services`, `inventory`, `expenses`, `deposits`, `reports`, `branches`, `users`, `roles`, `billing`, `pickupRequests`
- **6 actions**: `read`, `create`, `edit`, `delete`, `export`, `discount`
- **Wildcard `"*"`** grants all permissions (Owner only).

Source of truth: `lib/permissions/definitions.ts`.

### Which actions apply to which resource

```typescript
RESOURCE_ACTIONS: Record<Resource, Action[]> = {
  dashboard:     ["read"],
  orders:        ["read", "create", "edit", "delete", "discount"],
  customers:     ["read", "create", "edit", "delete"],
  services:      ["read", "create", "edit", "delete"],
  inventory:     ["read", "create", "edit", "delete"],
  expenses:      ["read", "create", "edit", "delete"],
  deposits:      ["read", "create", "edit"],
  reports:       ["read", "export"],
  branches:      ["read", "create", "edit", "delete"],
  users:         ["read", "create", "edit", "delete"],
  roles:         ["read", "create", "edit", "delete"],
  billing:       ["read"],
  pickupRequests:["read", "create", "edit", "delete"],
};
```

`ALL_PERMISSIONS` is computed from this map.

## Check a permission

**Server-side** (in API routes / server components):

```typescript
import { hasPermission } from "@/lib/permissions/definitions";

if (!hasPermission(user.permissions, "orders", "create")) {
  throw new ForbiddenError();
}
```

Or via the guard helpers (preferred — they also resolve session + tenant + branch):

```typescript
const ctx = await requireWithBranchOrThrow("orders", "create");
// or
const ctx = await requirePermissionOrThrow("users", "read");
```

See `docs/sop/api-routes.md` for the full guard table.

**Client-side** (in React components):

```typescript
import { usePermissions } from "@/hooks/use-permissions";

const { can, isLoading, isSuperAdmin } = usePermissions();

{can("orders", "create") && <NewOrderButton />}
```

## Super-admin bypass

`hasPermission()` short-circuits on `role === "SUPER_ADMIN"`. Super-admin sees everything regardless of `Role.permissions`.

This is enforced in `lib/auth.ts` (jwt callback) and `lib/permissions/check.ts`. Don't add manual bypasses per route.

## Default system roles

Seeded for every tenant by `lib/permissions/seed.ts:seedDefaultRoles()` on registration. Defined in `lib/permissions/defaults.ts`:

| Role | Color | Permissions |
|---|---|---|
| **Owner** | indigo | `["*"]` (wildcard — always re-pinned, cannot be locked out) |
| **Manager** | blue | Full operational access; no `billing` or `roles` |
| **Kasir** | emerald | Orders create, customers read/create, deposits, pickupRequests |
| **Staff** | amber | Dashboard, orders create, customers read, inventory read, pickupRequests read |

`isSystem: true` → cannot be deleted in the UI. Owner's permissions cannot be edited (always `["*"]`). Other system roles' permissions CAN be edited by the owner.

## Custom roles

Created at `/roles` (Permission Matrix editor). Stored as `Role.permissions: string[]`. The editor UI:

- Renders a grid: rows = resources, columns = actions.
- Only valid `RESOURCE_ACTIONS[resource]` cells are interactive.
- Saves a `string[]` of permission strings.

## Add a new resource (5 steps)

1. **Edit `lib/permissions/definitions.ts`**:
   - Add to `RESOURCES`
   - Add to `RESOURCE_ACTIONS`
   - Add a label in `RESOURCE_LABELS`

2. **Add to default roles** in `lib/permissions/defaults.ts` — pick which roles get which actions.

3. **Re-seed existing tenants** via backfill:
   ```bash
   npx tsx scripts/seed-rbac.ts
   ```
   This calls `seedDefaultRoles` (idempotent) — but note: existing roles keep their existing permissions; only the Owner wildcard gets re-pinned. For non-Owner roles, the owner must edit at `/roles` or you must write a one-off backfill.

4. **Add a feature flag** if the resource should be tenant-toggleable (see `docs/sop/feature-flags.md`). Most operational resources have one.

5. **Add nav entries** with `resource: "yourResource"` in `components/layout/app-sidebar.tsx`.

## Legacy `UserRole` enum

`User.role` still exists as an enum (`OWNER` / `MANAGER` / `EMPLOYEE`) for backward compatibility. `legacyRoleToDefaultName()` maps:
- `OWNER` → `Owner`
- `MANAGER` → `Manager`
- `EMPLOYEE` → `Kasir`

`backfillUserRoles()` links existing users (with `roleId: null`) to the right default role. New users always get a `roleId` at creation.

## Definition of done for a new resource

- [ ] Resource in `RESOURCES`
- [ ] Actions in `RESOURCE_ACTIONS`
- [ ] Label in `RESOURCE_LABELS`
- [ ] Granted to default roles (or intentionally excluded)
- [ ] Feature flag added + seeded (if applicable)
- [ ] Sidebar entries carry `resource: "yourResource"`
- [ ] API routes call `requireWithBranchOrThrow("yourResource", action)`
