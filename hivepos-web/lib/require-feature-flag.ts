import type { ApiSession } from "@/lib/get-session";
import { ForbiddenError } from "@/modules/shared";

// ponytail: server-side feature flag guard. One guard, three callers
// (API routes, server components, server actions). Reads from session —
// flags are resolved at login in lib/auth.ts and cached in the JWT.
// Super-admin bypasses (matches existing permission pattern).

/** Throws ForbiddenError if the flag is not enabled for the current session. */
export function requireFeatureFlag(key: string, session: ApiSession): void {
  if (session.user.role === "SUPER_ADMIN") return;
  const flags = session.user.featureFlags ?? {};
  if (!flags[key]) {
    throw new ForbiddenError("Feature not available");
  }
}

/** Boolean form — returns instead of throwing. */
export function hasFeatureFlag(key: string, session: ApiSession): boolean {
  if (session.user.role === "SUPER_ADMIN") return true;
  const flags = session.user.featureFlags ?? {};
  return flags[key] ?? true; // permissive on unknown flag
}
