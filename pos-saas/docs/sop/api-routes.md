# SOP: API Routes

The most-referenced SOP. Every API route in this codebase follows the same pattern.

## Standard pattern

```typescript
// app/api/<resource>/route.ts
import { withErrorHandler, parseBody, apiSuccess, apiCreated } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { exampleSchema } from "@/lib/validations";

export const GET = withErrorHandler(async (req) => {
  // 1. Permission check + session + branch context
  const ctx = await requireWithBranchOrThrow("orders", "read");

  // 2. Parse query params
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q") ?? undefined;

  // 3. Business logic — ALWAYS filter by ctx.tenantId (+ ctx.branchId if relevant)
  const orders = await prisma.order.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(ctx.isAllOutlets ? {} : { branchId: ctx.branchId }),
      ...(search ? { customer: { name: { contains: search, mode: "insensitive" } } } : {}),
    },
  });

  // 4. Return standardized success envelope
  return apiSuccess(orders, { total: orders.length });
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("orders", "create");

  // Validate body with zod
  const input = await parseBody(req, exampleSchema);

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: { tenantId: ctx.tenantId, branchId: ctx.branchId, ...input },
    });
    return order;
  });

  return apiCreated(order);
});
```

## Response envelope (`modules/shared/http/response.ts`)

```typescript
// Success: 200 (default) or 201 (created)
return apiSuccess(data, { page?, limit?, total?, totalPages? }); // → { success: true, data, meta? }
return apiCreated(data);                                          // → 201 with success envelope

// Pagination meta is optional but conventional for list endpoints
```

Errors flow through `withErrorHandler` — never build error responses manually. Throw the right `AppError` subclass.

## Parameter access

Dynamic route params (`app/api/foo/[id]/route.ts`):

```typescript
export const GET = withErrorHandler(async (req, ctx) => {
  // IMPORTANT: ctx is typed optional by withErrorHandler. Use non-null assertion.
  const { id } = await ctx!.params;
});
```

The `ctx!.params` non-null assertion is the project convention. See `app/api/super-admin/plans/[id]/route.ts:17` for a working example.

## Permission guards (`lib/permissions/check.ts`)

| Guard | When to use | Returns |
|---|---|---|
| `requireWithBranchOrThrow(resource, action)` | Operational routes (orders, customers, services, inventory, expenses, pickup, deposits) | `{ userId, tenantId, branchId, branchIds, isAllOutlets, permissions, activeModule }` |
| `requirePermissionOrThrow(resource, action)` | Tenant-scoped admin routes (users, roles, billing, branches mgmt) | `{ userId, tenantId, permissions }` |
| `assertSuperAdminOrThrow()` | Super-admin API (any role) | `{ session }` |
| `assertSuperAdminOrThrow("SUPER_ADMIN")` | Strict super-admin only (write operations, feature flags, admins) | `{ session }` |

**Super-admin bypasses all permission checks** automatically (`isAllowed()` short-circuits on `role === "SUPER_ADMIN"`).

## Tenant-scoped queries

**ALWAYS filter by `tenantId` from the session context.** Never trust client-supplied tenantId.

```typescript
// CORRECT
const orders = await prisma.order.findMany({
  where: {
    tenantId: ctx.tenantId,
    ...(ctx.isAllOutlets ? {} : { branchId: ctx.branchId }),
  },
});

// WRONG — security hole
const orders = await prisma.order.findMany({
  where: { branchId: body.branchId }, // ❌ no tenant scoping
});
```

**Inside transactions**, pass `tenantId` explicitly to every create:

```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: { tenantId: ctx.tenantId, branchId: ctx.branchId, ...rest },
  });
  await tx.orderItem.createMany({
    data: items.map((i) => ({
      tenantId: ctx.tenantId, // explicit
      orderId: order.id,
      ...i,
    })),
  });
});
```

## Error throwing (`modules/shared/errors/app-error.ts`)

Import from `@/modules/shared`:

```typescript
import { NotFoundError, ValidationError, ForbiddenError, BusinessRuleError } from "@/modules/shared";
```

| Class | When | HTTP |
|---|---|---|
| `ValidationError(message, { details?, cause? })` | Zod fail / manual validation | 400 |
| `InvalidInputError(message)` | Bad input shape | 400 |
| `UnauthenticatedError(message?)` | No session | 401 |
| `ForbiddenError(message?)` | General permission denied | 403 |
| `InsufficientPermissionError(resource, action)` | Missing specific RBAC permission | 403 |
| `NotFoundError(resource, id?)` | Resource lookup failed | 404 |
| `ConflictError(message, { cause? })` | Unique constraint / state conflict | 409 |
| `BusinessRuleError(message, { code?, cause? })` | Operation violates business logic | 400 |
| `InvalidStatusTransitionError(from, to)` | Bad status change | 400 |
| `InsufficientBalanceError(message?)` | Wallet/deposit too low | 400 |
| `AmountExceedsBalanceError(message?)` | Payment > remaining balance | 400 |
| `OutletLockedError(message?)` | Branch subscription expired | 403 |
| `SubscriptionLimitReachedError(message, details?)` | Plan limit hit | 403 |
| `DatabaseError(message, { cause? })` | Prisma internal failure | 500 |
| `ExternalServiceError(service, message, { cause? })` | Midtrans / Google / SMTP failure | 502 |
| `InternalError(message, { cause? })` | Catch-all unexpected | 500 |
| `RateLimitError(message?)` | Too many requests | 429 |

**Constructor signatures:**
- `new NotFoundError("Order", id)` → `"Order not found (id: abc-123)"`
- `new ValidationError("Email is required", { details: [{ field: "email", message: "required" }] })`
- `new BusinessRuleError("Only pending orders can be canceled")`

## Audit logging (`lib/audit.ts`)

Every super-admin mutation MUST write an `auditLog` row inside the same `prisma.$transaction`:

```typescript
import { auditLog } from "@/lib/audit";

await prisma.$transaction(async (tx) => {
  await tx.tenant.update({
    where: { id: tenantId },
    data: { isActive: false },
  });

  await auditLog(tx, {
    actor: { id: session.user.id!, email: session.user.email! },
    action: "tenant.suspend",                    // dotted: <domain>.<verb>
    target: { type: "Tenant", id: tenantId, tenantId },
    reason: "Payment overdue",
    diff: { isActive: true → false },            // optional, useful for diffs
    req,                                         // captures IP + User-Agent
  });
});
```

**Action naming convention**: `<domain>.<verb>` — e.g. `tenant.suspend`, `tenant.approve`, `billing.refund`, `featureFlag.update`, `featureFlag.tenantOverride`, `featureFlag.tenantOverrideRemoved`, `featureFlag.create`, `featureFlag.delete`, `superAdmin.create`, `plan.update`, `promoCode.redeem`.

**AuditLogInput fields:**
- `actor`: `{ id, email }` — from `session.user`
- `action`: dotted string
- `target`: `{ type: "Tenant" | "SaaSPayment" | "FeatureFlag" | ..., id, tenantId? }`
- `reason?`: human-readable why
- `diff?`: `Record<string, unknown>` — useful for field-level changes
- `req?`: Next.js `Request` — used to extract IP (`x-forwarded-for` / `x-real-ip`) and UA

## Feature flag guard

```typescript
import { requireFeatureFlag } from "@/lib/require-feature-flag";

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("inventory", "create");

  // Throws ForbiddenError if flag is off for this tenant
  requireFeatureFlag("inventory", ctx.session);

  // ... handler
});
```

Super-admin bypasses the flag check. Unknown flags default to `true` (permissive).

## Body parsing

**With zod (preferred for non-trivial bodies):**
```typescript
import { parseBody } from "@/modules/shared";
import { z } from "zod/v4";

const schema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

export const POST = withErrorHandler(async (req) => {
  const input = await parseBody(req, schema); // typed + validated
});
```

**Manual (for simple cases):**
```typescript
const body = await req.json().catch(() => ({}));
const name = typeof body?.name === "string" ? body.name.trim() : "";
if (!name) throw new ValidationError("Name is required");
```

## Full annotated example

Reference: `app/api/orders/route.ts`. Key points:
1. `withErrorHandler` wraps everything
2. `requireWithBranchOrThrow` resolves permission + tenant + branch in one call
3. Listens for query params via `new URL(req.url).searchParams`
4. Filters by `ctx.tenantId` AND `ctx.branchId` (unless ALL mode)
5. Returns `apiSuccess(data, { total })` with pagination meta

Reference for super-admin CRUD: `app/api/super-admin/feature-flags/[id]/route.ts` — shows the `ctx!.params` pattern, `auditLog` inside transaction, `NotFoundError` on missing.
