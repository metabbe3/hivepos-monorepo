import type { BusinessModule } from "@/modules/shared/domain/business-module";
import {
  hasPermission as hasPermissionFromDefinitions,
  type Resource,
  type Action,
} from "@/lib/permissions/definitions";

/**
 * Minimal tenant-scoped request context.
 *
 * Used by tenant-admin modules (users, roles, branches, billing) where
 * operations are not branch-scoped — only identity and tenant matter.
 */
export interface TenantRequestContext {
  userId: string;
  tenantId: string;
  permissions: string[];
}

/**
 * Branch-scoped request context — extends the tenant context with branch
 * resolution and the active business module.
 *
 * Derived from the authenticated session and passed to every application
 * service in branch-operational modules (orders, customers, inventory,
 * services, expenses) so business logic doesn't touch session internals.
 */
export interface BranchRequestContext extends TenantRequestContext {
  /** Single branch id, or "ALL" when the user manages every outlet. */
  branchId: string;
  /** Branch ids the user can access (resolved from "ALL" if needed). */
  branchIds: string[];
  isAllOutlets: boolean;
  /** The business module the user is currently viewing (laundry, fnb, …). */
  activeModule: BusinessModule;
}

/**
 * Check whether the context grants a specific permission.
 *
 * Accepts either context shape since both expose `permissions`.
 * Delegates to the canonical implementation in `lib/permissions/definitions`
 * so the wildcard + permission-string semantics stay in one place.
 *
 * `resource` and `action` are intentionally `string` (not the `Resource` /
 * `Action` unions) to keep call sites ergonomic; the cast is safe because the
 * underlying check is a substring comparison, not an enum lookup.
 */
export function hasPermission(
  ctx: TenantRequestContext,
  resource: string,
  action: string,
): boolean {
  return hasPermissionFromDefinitions(
    ctx.permissions,
    resource as Resource,
    action as Action,
  );
}
