"use client";

import { useCallback, useMemo } from "react";
import { useSession } from "@/lib/auth-client";
import { hasPermission, type Resource, type Action } from "@/lib/permissions/definitions";
import { DEFAULT_ROLES } from "@/lib/permissions/defaults";

/**
 * React hook for checking RBAC permissions on the client.
 *
 * Usage:
 *   const { can, permissions, isLoading } = usePermissions();
 *   if (can("orders", "create")) { ... }
 */
export function usePermissions() {
  const { data: session, status } = useSession();
  // hivepos-api /auth/me returns the role NAME in permissions (e.g. ["OWNER"]), not the
  // expanded list. Merge the role's default permissions (DEFAULT_ROLES: Owner→["*"]) so the
  // sidebar's can() resolves correctly. Safe no-op once Go sends the full list.
  const rawPerms = (session?.user?.permissions ?? []) as string[];
  const role = session?.user?.role as string | undefined;
  const roleDefaultPerms =
    (role && DEFAULT_ROLES.find((r) => r.name.toUpperCase() === role.toUpperCase())?.permissions) ||
    [];
  const permissions = Array.from(new Set([...rawPerms, ...roleDefaultPerms]));
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const isLoading = status === "loading";

  // ponytail: stable callback — permissions only changes on session refresh,
  // so `can` keeps identity across renders and downstream memo/memoized
  // components don't re-render unnecessarily.
  const can = useCallback(
    (resource: Resource, action: Action): boolean => {
      if (isSuperAdmin) return true;
      return hasPermission(permissions, resource, action);
    },
    [isSuperAdmin, permissions]
  );

  return useMemo(
    () => ({ can, permissions, isLoading, isSuperAdmin }),
    [can, permissions, isLoading, isSuperAdmin]
  );
}
