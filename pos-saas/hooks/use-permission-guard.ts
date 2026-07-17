"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "./use-permissions";
import type { Resource, Action } from "@/lib/permissions/definitions";

/**
 * Redirect the user away if they lack the given permission.
 *
 * Usage (top of a page component):
 *   const { allowed, isLoading } = usePermissionGuard("reports", "read");
 *   if (isLoading || !allowed) return null;
 *
 * @param redirectTo defaults to "/dashboard"
 */
export function usePermissionGuard(
  resource: Resource,
  action: Action,
  redirectTo = "/dashboard",
) {
  const { can, isLoading } = usePermissions();
  const router = useRouter();
  const allowed = can(resource, action);

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace(redirectTo);
    }
  }, [allowed, isLoading, router, redirectTo]);

  return { allowed, isLoading };
}
