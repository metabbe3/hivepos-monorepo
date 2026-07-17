/**
 * API-level permission enforcement helpers.
 *
 * Usage patterns:
 *
 *   // Route that needs branch context (orders, customers, services, ...)
 *   const guard = await requireWithBranch("orders", "read");
 *   if (guard.error) return guard.error;
 *   const { session, branchId, branchIds, tenantId, isAllOutlets } = guard;
 *
 *   // Route that doesn't need branch context (users, roles, billing, ...)
 *   const guard = await requirePermission("users", "create");
 *   if (guard.error) return guard.error;
 *   const { session } = guard;
 */

import { NextResponse } from "next/server";
import { getApiSession, type ApiSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "./definitions";
import type { Resource, Action } from "./definitions";
import {
  UnauthenticatedError,
  ForbiddenError,
} from "@/modules/shared/errors/app-error";
import type { BusinessModule } from "@/modules/orders/domain/types";
import { sessionModule } from "@/lib/module-filter";

export type PermissionGuardOk = {
  ok: true;
  session: ApiSession;
};

export type PermissionGuardErr = {
  ok: false;
  error: NextResponse;
};

export type BranchGuardOk = {
  ok: true;
  session: ApiSession;
  branchId: string;
  branchIds: string[];
  tenantId: string;
  isAllOutlets: boolean;
};

/**
 * Check whether the session's user is allowed to perform resource:action.
 * Super admins and the wildcard "*" permission bypass all checks.
 */
function isAllowed(session: ApiSession, resource: Resource, action: Action): boolean {
  if (session.user.role === "SUPER_ADMIN") return true;
  return hasPermission(session.user.permissions, resource, action);
}

/**
 * Require a permission for the current session. Does NOT load branch context.
 * Use for admin routes (users, roles, billing, branches management).
 */
export async function requirePermission(
  resource: Resource,
  action: Action,
): Promise<PermissionGuardOk | PermissionGuardErr> {
  const session = await getApiSession();
  if (!session) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isAllowed(session, resource, action)) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  // Guard: tenant-scoped routes require a valid tenantId. Super-admin sessions
  // carry tenantId:null (platform-level, not tenant-scoped) — they must
  // impersonate a tenant before accessing tenant-scoped endpoints. Without
  // this guard, null flows into Prisma where clauses and causes opaque 500s.
  if (!session.user.tenantId) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Session missing tenant context" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}

/**
 * Require a permission AND resolve branch context for the current session.
 * Use for operational routes (orders, customers, services, inventory, expenses).
 */
export async function requireWithBranch(
  resource: Resource,
  action: Action,
): Promise<BranchGuardOk | PermissionGuardErr> {
  const guard = await requirePermission(resource, action);
  if (!guard.ok) return guard;

  const session = guard.session;
  const branchId = session.user.branchId;
  const tenantId = session.user.tenantId;

  // Guard: if the user has no branchId at all (e.g. a super-admin session
  // that hasn't impersonated a tenant, or a stale token), we cannot build a
  // valid Prisma `in` filter. Branch IDs would be [null] / ["" ] which Prisma
  // rejects with "Invalid value provided". Return a clean 403 instead.
  if (!branchId) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Session missing branch context" },
        { status: 403 },
      ),
    };
  }

  if (branchId === "ALL") {
    // Guard: ALL-outlets mode requires tenantId to query branches.
    // Without this, Prisma throws "tenantId must not be null".
    if (!tenantId) {
      return {
        ok: false,
        error: NextResponse.json(
          { error: "Session missing tenant context for ALL-outlets query" },
          { status: 403 },
        ),
      };
    }
    const branches = await prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: { id: true },
    });
    // Guard: if tenant has no active branches, return a sentinel that will
    // cause downstream queries to return empty results rather than crashing
    // with `in: []` (which Prisma treats as `in: [null]`).
    return {
      ok: true,
      session,
      branchId: "ALL",
      branchIds: branches.map((b) => b.id),
      tenantId,
      isAllOutlets: true,
    };
  }

  return {
    ok: true,
    session,
    branchId,
    branchIds: [branchId],
    tenantId,
    isAllOutlets: false,
  };
}

// ── Throwing variants for use with withErrorHandler ──────────────────────

/**
 * Require a permission and resolve branch context, throwing AppError on failure
 * instead of returning a NextResponse.
 *
 * Use inside `withErrorHandler` so permission errors flow through the same
 * standardized envelope as all other errors:
 *
 *   export const POST = withErrorHandler(async (req) => {
 *     const ctx = await requireWithBranchOrThrow("orders", "create");
 *     ...
 *   });
 *
 * Returns a RequestContext suitable for passing to application services.
 */
export async function requireWithBranchOrThrow(resource: Resource, action: Action) {
  const guard = await requireWithBranch(resource, action);
  if (!guard.ok) {
    // Determine whether it was an auth or permission failure by inspecting the
    // status code embedded in the NextResponse. This avoids duplicating the
    // session/permission logic and keeps the existing guard as the source of truth.
    const status = guard.error.status;
    throw status === 401
      ? new UnauthenticatedError()
      : new ForbiddenError(`Missing permission: ${resource}:${action}`);
  }

  const activeModule: BusinessModule = sessionModule(guard.session.user.activeModule);

  // Defense-in-depth: if branchIds resolved to an empty array (tenant has no
  // active branches), downstream `prisma.*.findMany({ where: { branchId: { in: [] } } })`
  // crashes on Prisma with "Argument `in`: Invalid value provided. Expected
  // ListStringFieldRefInput, provided (Null)." We inject a sentinel that will
  // never match any row, so queries return [] gracefully instead of crashing.
  const safeBranchIds = guard.branchIds.length > 0 ? guard.branchIds : ["__NO_BRANCHES__"];

  return {
    userId: guard.session.user.id,
    tenantId: guard.tenantId,
    branchId: guard.branchId,
    branchIds: safeBranchIds,
    isAllOutlets: guard.isAllOutlets,
    permissions: guard.session.user.permissions,
    activeModule,
  };
}

/**
 * Require a permission WITHOUT branch context, throwing AppError on failure.
 *
 * Use inside `withErrorHandler` for tenant-scoped admin routes (billing,
 * subscription, tenant settings) that don't need a branch filter:
 *
 *   export const GET = withErrorHandler(async () => {
 *     const ctx = await requirePermissionOrThrow("billing", "read");
 *     ...
 *   });
 */
export async function requirePermissionOrThrow(resource: Resource, action: Action) {
  const guard = await requirePermission(resource, action);
  if (!guard.ok) {
    const status = guard.error.status;
    throw status === 401
      ? new UnauthenticatedError()
      : new ForbiddenError(`Missing permission: ${resource}:${action}`);
  }

  return {
    userId: guard.session.user.id,
    tenantId: guard.session.user.tenantId,
    permissions: guard.session.user.permissions,
  };
}
