# SOP: Super-admin Panel

How the platform-side (super-admin) panel works. Separate auth, separate sidebar, separate concerns.

## Auth gate

**Server component (page)**:
```typescript
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";

export default async function Page() {
  await requireSuperAdminPanelSession();
  // throws/redirects: /super-admin/login if unauth, /dashboard if wrong role
  return <Manager />;
}
```

**API route**:
```typescript
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";

export const GET = withErrorHandler(async () => {
  const { session } = await assertSuperAdminOrThrow();          // SUPER_ADMIN or SUPPORT
  // OR
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN"); // strict
  // ...
});
```

Path convention: panel pages live under `app/super-admin/(panel)/` (route group, doesn't affect URL).

## Two roles

| Role | Sees | Can mutate |
|---|---|---|
| `SUPER_ADMIN` | Everything | Everything |
| `SUPPORT` | Everything (read) | Tickets, error logs (resolve). No admins / feature flags / settings |

`superAdminOnly: true` on a sidebar item hides it from `SUPPORT`. Apply to: Admins, Feature Flags, anything sensitive.

## Sidebar structure

`components/layout/super-admin-sidebar.tsx` uses `NAV_GROUPS` (3 sections):

```typescript
const NAV_GROUPS = [
  { label: "Monitor",    items: [Overview, Performance, Health, Pickup Insights] },
  { label: "Customers",  items: [Tenants, Plans, Promo Codes, Billing, Users] },
  { label: "Operations", items: [Tickets, Error Logs, Audit Log, Admins*, Feature Flags*, Settings] },
];
```

`*` = `superAdminOnly: true`.

NavItem shape: `{ title: string; href: string; icon: any; superAdminOnly?: boolean }`. **No translation keys** — labels are English-only (admin-only UI).

## Panel UI pattern

Server component (auth guard + optional pre-fetch) → client manager component:

```typescript
// app/super-admin/(panel)/tenants/page.tsx
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { TenantsManager } from "./tenants-manager";

export default async function TenantsPage() {
  await requireSuperAdminPanelSession();
  return <TenantsManager />;
}
```

Client manager uses `apiFetch` for everything. Optimistic updates on toggles (flip UI immediately, revert on error with toast).

## Audit logging (required)

**Every super-admin mutation** writes an `auditLog` row inside the same `prisma.$transaction`:

```typescript
import { auditLog } from "@/lib/audit";

await prisma.$transaction(async (tx) => {
  await tx.tenant.update({
    where: { id: tenantId },
    data: { isActive: false },
  });

  await auditLog(tx, {
    actor: { id: session.user.id!, email: session.user.email! },
    action: "tenant.suspend",
    target: { type: "Tenant", id: tenantId, tenantId },
    reason: "Payment overdue",
    req,
  });
});
```

Action naming: `<domain>.<verb>` — `tenant.suspend`, `tenant.approve`, `billing.refund`, `featureFlag.update`, `featureFlag.tenantOverride`, `plan.update`, `promoCode.redeem`, `superAdmin.create`, etc.

See `docs/sop/api-routes.md` for the full audit signature.

## Impersonation

Super-admin can swap to any tenant user to debug issues.

**Start**:
```
POST /api/super-admin/impersonate { impersonateUserId }
```
- JWT callback snapshots current token to `token.preImpersonation`
- Swaps claims to target user
- Resolves target tenant's featureFlags
- Banner shows "Impersonating {email}"

**Stop**:
```
POST /api/super-admin/impersonate/stop { stopImpersonation: true }
```
- JWT callback restores from `preImpersonation` snapshot

See `docs/architecture.md` for the JWT callback details.

## Error log viewer

`/super-admin/error-logs` shows all 5xx errors auto-persisted via `instrumentation.ts` server boot hook.

- Filter by tenant / resolved status
- "Resolve" action flips the `resolved` flag (audit-logged in `AuditLog`)
- Stack trace + metadata available for debugging

## Session management

- `/super-admin/me/password` — change own password
- `/super-admin/me/sessions` — active session management
- Session version enforced on every API call via `lib/get-session.ts`

## Definition of done for a super-admin mutation

- [ ] Page guards via `requireSuperAdminPanelSession()`
- [ ] API guards via `assertSuperAdminOrThrow()` (or strict variant)
- [ ] `auditLog` row inside `prisma.$transaction` with dotted action
- [ ] Sidebar entry has `superAdminOnly: true` if sensitive
- [ ] Optimistic UI updates with revert-on-error
