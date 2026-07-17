"use client";

import { usePermissionGuard } from "./use-permission-guard";
import type { Resource, Action } from "@/lib/permissions/definitions";

/**
 * Thin wrapper around `usePermissionGuard` that also exposes a single
 * `shouldRender` flag. Pages can replace:
 *
 *   const { allowed, isLoading } = usePermissionGuard("users", "read");
 *   if (isLoading || !allowed) return null;
 *
 * with:
 *
 *   const { shouldRender } = useGuardedPage("users", "read");
 *   if (!shouldRender) return null;
 *
 * Semantics are identical: `shouldRender` is `true` only when permissions
 * have finished loading AND the user is allowed.
 */
export function useGuardedPage(
  resource: Resource,
  action: Action,
  redirectTo = "/dashboard",
) {
  const guard = usePermissionGuard(resource, action, redirectTo);
  const shouldRender = guard.allowed && !guard.isLoading;
  return { ...guard, shouldRender };
}
