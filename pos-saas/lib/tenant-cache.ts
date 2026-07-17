import { prisma } from "@/lib/prisma";

/**
 * ponytail: per-slug TTL cache for subdomain lookups. Middleware hits this on
 * every tenant-site request. 60s TTL = at most a couple DB queries/min per slug.
 * In-process Map — fine while we run a single instance. Add Redis if we scale
 * horizontally. Bump on tenant update is implicit via TTL.
 */

const TTL_MS = 60_000;

interface CachedEntry {
  tenant: TenantPublicData | null;
  expiresAt: number;
}

export interface TenantPublicData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  websiteEnabled: boolean;
  websitePublishedAt: Date | null;
  settings: unknown;
  branches: Array<{
    id: string;
    name: string;
    slug: string | null;
    address: string | null;
    phone: string | null;
    whatsappLink: string | null;
    googleMapsLink: string | null;
    latitude: number | null;
    longitude: number | null;
    operatingHours: unknown;
  }>;
}

const cache = new Map<string, CachedEntry>();

/**
 * Returns the tenant's public website data, or null if slug unknown / not Pro.
 * ponytail: gates websiteEnabled AND an active Pro-priced payment in one extra
 * query. Coverage check (coverageEnd > now) means cancelled Pros fall out of
 * cache naturally as their coverage expires.
 */
export async function getCachedTenantBySlug(slug: string): Promise<TenantPublicData | null> {
  const key = slug.toLowerCase();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.tenant;

  const tenant = await fetchTenantBySlug(key);
  cache.set(key, { tenant, expiresAt: now + TTL_MS });
  return tenant;
}

async function fetchTenantBySlug(slug: string): Promise<TenantPublicData | null> {
  const t = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      websiteEnabled: true,
      websitePublishedAt: true,
      settings: true,
      branches: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          phone: true,
          whatsappLink: true,
          googleMapsLink: true,
          latitude: true,
          longitude: true,
          operatingHours: true,
        },
      },
    },
  });
  if (!t || !t.websiteEnabled) return null;

  // Pro gate: must have a PAID Pro-priced payment with active coverage.
  const proPayment = await prisma.saaSPayment.findFirst({
    where: {
      tenantId: t.id,
      status: "PAID",
      unitPrice: { gte: 79000 },
      coverageEnd: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!proPayment) return null;

  return t;
}

/**
 * ponytail: invalidation hook. Call after tenant.settings or websiteEnabled
 * changes. Simple delete — next read repopulates. Cheap because writes are rare.
 */
export function invalidateTenantCache(slug: string): void {
  cache.delete(slug.toLowerCase());
}
