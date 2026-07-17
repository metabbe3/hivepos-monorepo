import { prisma } from "@/lib/prisma";

// ponytail: feature flag resolver. Single source of truth — called from
// lib/auth.ts (jwt callback), super-admin API, and ad-hoc server code.
// Resolution rule: per-tenant override wins over global default when present.
// Unknown flags default to true (permissive) so a missing seed never hides a
// feature.

// ponytail: per-tenant read-through cache. resolveAllFlags is called on every
// auth'd request (jwt callback × credentials/Google/refresh/impersonation) +
// by resolveFlag. 30s TTL bounds staleness; invalidateFeatureFlags() is wired
// into the super-admin toggle endpoints so a change is effective immediately.
// In-process Map — fine for the single Docker instance; add Redis if we scale.
const FLAG_CACHE_TTL_MS = 30_000;
const flagCache = new Map<string, { flags: Record<string, boolean>; expiresAt: number }>();

/** All resolved flag keys for a tenant: { website: true, inventory: false, ... }. */
export async function resolveAllFlags(
  tenantId: string,
): Promise<Record<string, boolean>> {
  const now = Date.now();
  const hit = flagCache.get(tenantId);
  if (hit && hit.expiresAt > now) return hit.flags;

  const flags = await resolveFlagsFromDb(tenantId);
  flagCache.set(tenantId, { flags, expiresAt: now + FLAG_CACHE_TTL_MS });
  return flags;
}

async function resolveFlagsFromDb(
  tenantId: string,
): Promise<Record<string, boolean>> {
  const flags = await prisma.featureFlag.findMany({
    include: { overrides: { where: { tenantId } } },
  });
  const out: Record<string, boolean> = {};
  for (const f of flags) {
    const override = f.overrides[0];
    out[f.key] = override ? override.enabled : f.enabled;
  }
  return out;
}

/**
 * Invalidate the flag cache. Pass a `tenantId` to clear one tenant (after a
 * per-tenant override change); omit to clear ALL tenants (after a global flag
 * default is created/toggled/deleted). Called from the super-admin flag routes
 * so toggles are effective immediately instead of after the 30s TTL.
 */
export function invalidateFeatureFlags(tenantId?: string): void {
  if (tenantId) flagCache.delete(tenantId);
  else flagCache.clear();
}

/**
 * Same as `resolveAllFlags` but never throws — used in the auth jwt callback
 * (Non-negotiable #8: flags must resolve in every auth path). On DB error we
 * return `{}` rather than aborting login/session-refresh.
 *
 * ponytail: empty-map on failure hides features in the UI until the next
 * session refresh, but the real gate is `requireFeatureFlag`/`hasFeatureFlag`
 * which re-resolve from the DB per request — so this never grants access. The
 * alternative (letting it throw) makes a transient flag-query hiccup lock users
 * out entirely. Upgrade path: if flags ever become the sole gate, resolve
 * synchronously from a cached snapshot instead of swallowing the error.
 */
export async function resolveAllFlagsSafe(
  tenantId: string,
): Promise<Record<string, boolean>> {
  try {
    return await resolveAllFlags(tenantId);
  } catch {
    return {};
  }
}

/** Resolve a single flag for a tenant. Unknown flag → true (permissive). */
export async function resolveFlag(
  key: string,
  tenantId: string,
): Promise<boolean> {
  // Delegates to the cached resolveAllFlags — same permissive-unknown semantics,
  // one DB round-trip per 30s per tenant instead of per call.
  const all = await resolveAllFlags(tenantId);
  return all[key] ?? true;
}

/** Catalog of all flag keys referenced in code. Keeps the seed + sidebar in sync. */
export const FLAG_KEYS = [
  "dashboard",
  "orders",
  "customers",
  "services",
  "inventory",
  "expenses",
  "deposits",
  "pickupRequests",
  "reports",
  "branches",
  "users",
  "roles",
  "billing",
  "website",
  "tickets",
  // ponytail: off by default — dogfood on a single tenant first, flip via
  // super-admin override. If this is generally useful we flip the global default.
  "offlineOrderCreate",
  "printerSettings",
  "orderPhotos",
  // Referral program (reward on first paid payment). Platform kill-switch —
  // flip off globally if abused; per-tenant override for dogfooding/targeting.
  "referralProgram",
  // Friction reduction (see docs/specs/customer-csv-import.md & onboarding-wizard.md).
  "customersImportExport",
  "onboardingWizard",
  "orderFlowV2",
  "staffAttendance",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];
