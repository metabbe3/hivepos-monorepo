"use client";

import { useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { hasPermission, type Resource, type Action } from "@/lib/permissions/definitions";

/**
 * React hook for checking RBAC permissions on the client.
 *
 * Usage:
 *   const { can, permissions, isLoading } = usePermissions();
 *   if (can("orders", "create")) { ... }
 */
export function usePermissions() {
  const { data: session, status } = useSession();
  const permissions = session?.user?.permissions ?? [];
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
