// ═══════════════════════════════════════════════════════════════
// Tenant resolution — determines which tenant a request belongs to
// Supports: subdomain routing + custom domains + localhost (query param)
// ═══════════════════════════════════════════════════════════════

import { headers } from "next/headers";
import { prisma } from "./prisma";

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN || "localhost";

/**
 * Resolve tenant from the current request's host.
 * 
 * In production: `berkah.hivepos.id` → slug = "berkah"
 * In development: `localhost:3007` → uses ?tenant=slug query param, or default tenant
 */
export async function getTenantSlug(): Promise<string | null> {
  const headerList = await headers();
  const host = headerList.get("host") || "";
  
  // Development mode: use query param or return null (show platform landing)
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return null;
  }

  // Extract subdomain: "berkah.hivepos.id" → "berkah"
  // Also handle "berkah.localhost:3007" for local multi-tenant testing
  const parts = host.split(".");
  if (parts.length >= 3) {
    // "berkah.hivepos.id" → slug = "berkah"
    const subdomain = parts[0];
    if (subdomain && subdomain !== "www") {
      return subdomain;
    }
  }

  return null;
}

/**
 * Get the full tenant record for the current request.
 * Returns null on platform-level pages (localhost, main domain).
 */
export async function getCurrentTenant() {
  const slug = await getTenantSlug();
  if (!slug) return null;

  return prisma.tenant.findUnique({
    where: { slug },
    include: {
      subscription: { include: { plan: true } },
    },
  });
}

/**
 * Check if the current host is the platform admin (super admin).
 * Platform admin is served from the main domain (no subdomain).
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const slug = await getTenantSlug();
  return slug === null;
}
