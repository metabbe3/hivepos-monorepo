import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware: subdomain routing for tenant websites.
// - *.hivepos.id/ (root) → /tenant-site (tenant's public website)
// - *.hivepos.id/track/* → public order tracking (tenant-scoped)
// - *.hivepos.id/login, /register, /dashboard etc → redirect to hivepos.id (platform domain)
//   so the tenant subdomain ONLY serves the public website.
// - hivepos.id/ (platform) → marketing landing + dashboard + auth

const STATIC_EXTENSIONS = /\.(jpg|jpeg|png|gif|svg|ico|webp|mp4|pdf|woff2?|txt|xml|webmanifest)$/i;

// Paths that belong to the tenant's public website (served on subdomains).
const TENANT_PUBLIC_PATHS = ["/", "/track"];

// Paths that belong to the platform (redirected from subdomains to hivepos.id).
const PLATFORM_PATHS = ["/login", "/register", "/dashboard", "/customers", "/users",
  "/branches", "/billing", "/website", "/profile", "/settings", "/reporting",
  "/laundry", "/attendance", "/tickets", "/roles", "/onboarding", "/printer-settings",
  "/whatsapp-templates", "/super-admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets
  if (STATIC_EXTENSIONS.test(pathname)) return NextResponse.next();
  if (["/icon", "/apple-icon", "/opengraph-image", "/twitter-image", "/sw.js"].includes(pathname)) {
    return NextResponse.next();
  }

  // ── Extract tenant slug from subdomain ──
  const host = req.headers.get("host") || "";
  let tenantSlug: string | null = null;

  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    const parts = host.split(".");
    if (parts.length >= 3 && parts[0] !== "www") {
      tenantSlug = parts[0];
    }
  }

  // Dev: ?tenant=slug for multi-tenant testing
  if (!tenantSlug) {
    const tenantParam = req.nextUrl.searchParams.get("tenant");
    if (tenantParam) tenantSlug = tenantParam;
  }

  // No tenant slug → platform request, pass through.
  if (!tenantSlug) {
    const res = NextResponse.next();
    // noindex auth-gated/platform routes — belt for robots.txt. Client-component layouts
    // (dashboard, super-admin) can't export metadata, so the header is the meta-level noindex.
    // PLATFORM_PATHS covers login/register + every dashboard/admin area (scattered URL roots).
    const isPlatformPath = PLATFORM_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (isPlatformPath) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  // ── Tenant subdomain: serve ONLY the public website ──

  // Root path → rewrite to tenant-site
  if (pathname === "/" && !req.nextUrl.searchParams.get("tenant")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-tenant-slug", tenantSlug);
    return NextResponse.rewrite(new URL("/tenant-site", req.url), {
      request: { headers: requestHeaders },
    });
  }

  // /track/* → public order tracking (rewrite to tenant-site's track page)
  if (pathname.startsWith("/track")) {
    return NextResponse.next();
  }

  // /api/* → pass through (API works on any domain)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Google OAuth callback with googleToken → pass through (needs to load /login to consume the token)
  if (pathname === "/login" && req.nextUrl.searchParams.get("googleToken")) {
    return NextResponse.next();
  }

  // All other paths on a tenant subdomain → redirect to the platform domain.
  // The tenant subdomain is purely the public website; login/dashboard/etc live on hivepos.id.
  const parts = host.split(".");
  if (parts.length >= 3) {
    const platformHost = parts.slice(1).join("."); // e.g. hivepos.id
    const platformUrl = `https://${platformHost}${pathname}${req.nextUrl.search}`;
    return NextResponse.redirect(platformUrl, 302);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
