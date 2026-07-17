import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ponytail: .txt added so /robots.txt and /llms.txt don't fall through to the
// unauthenticated → /login redirect. Anything under /public is public by design.
const STATIC_EXTENSIONS = /\.(jpg|jpeg|png|gif|svg|ico|webp|mp4|pdf|woff2?|txt|xml|webmanifest)$/i;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets
  if (STATIC_EXTENSIONS.test(pathname)) return NextResponse.next();

  // Next.js file-convention image routes (no extension on URL) — always public.
  // ponytail: would be cleaner to extend the matcher regex, but inline keeps the diff small.
  if (
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/opengraph-image" ||
    pathname === "/twitter-image"
  ) {
    return NextResponse.next();
  }

  // Service worker must be public — the browser fetches /sw.js without auth
  // cookies during scope resolution. Without this it redirects to /login and
  // SW registration fails silently.
  if (pathname === "/sw.js") return NextResponse.next();

  // ── Extract tenant slug from subdomain ──
  const host = req.headers.get("host") || "";
  let tenantSlug: string | null = null;

  // Development: localhost → no tenant (platform level)
  // Production: berkah.hivepos.id → tenant "berkah"
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    const parts = host.split(".");
    if (parts.length >= 3 && parts[0] !== "www") {
      tenantSlug = parts[0];
    }
  }

  // In dev mode, support ?tenant=slug for multi-tenant testing
  if (!tenantSlug) {
    const tenantParam = req.nextUrl.searchParams.get("tenant");
    if (tenantParam) tenantSlug = tenantParam;
  }

  // ── Tenant subdomain website: rewrite root path to /tenant-site ──
  // ponytail: middleware is Edge Runtime — no Prisma. We rewrite purely on
  // subdomain presence; tenant-site page does the actual cache lookup and
  // redirects to /tenant-not-found when slug is invalid/inactive.
  if (tenantSlug && pathname === "/" && !req.nextUrl.searchParams.get("tenant")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-tenant-slug", tenantSlug);
    return NextResponse.rewrite(new URL("/tenant-site", req.url), {
      request: { headers: requestHeaders },
    });
  }

  // ── Cookie / token auth check ──
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  const bearerToken = req.headers
    .get("authorization")
    ?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7)
    : null;

  // Rewrite bearer token to cookie for API routes
  if (bearerToken && pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("cookie", `authjs.session-token=${bearerToken}`);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Route classification ──
  const isPublicPage =
    pathname === "/" ||
    pathname === "/landing" ||
    pathname === "/demo" ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/alternatif-moka-pos-laundry") ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/pickup") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/blog");
  const isLoginRoute = pathname.startsWith("/login");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isPublicApi = pathname.startsWith("/api/public");
  const isSuperAdminRoute = pathname.startsWith("/super-admin");
  const isSuperAdminLoginRoute = pathname === "/super-admin/login";

  // Auth endpoints — always pass through
  if (isApiAuth) return NextResponse.next();

  // Health check — unauthed, for Docker/k8s liveness probes (Phase 8)
  if (pathname === "/api/health") return NextResponse.next();

  // PWA nonce — unauthed, polled by every installed client to detect
  // super-admin force-update. Session-gating it would block the poll when
  // the user is logged out (installed PWA, pre-login), defeating the purpose.
  if (pathname === "/api/pwa/nonce") return NextResponse.next();

  // Midtrans webhook — unauthed; signature verified in the route handler.
  if (pathname === "/api/billing/webhook") return NextResponse.next();

  // Public pages
  if (isPublicPage) {
    if (sessionToken && pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Public API
  if (isPublicApi) return NextResponse.next();

  // ponytail: public order tracking API — called from /track/[orderNumber]
  // which is itself a public page. Tenant scoping happens in the route handler
  // via x-tenant-slug header; no auth needed (order number is the capability).
  // ponytail: propagate subdomain → header here, otherwise cross-tenant order
  // enumeration is possible (route handler's check is bypassed). Add other
  // public APIs needing tenant scoping here if added later.
  if (pathname.startsWith("/api/track/")) {
    if (tenantSlug) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-tenant-slug", tenantSlug);
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return NextResponse.next();
  }

  // Registration endpoint — public (creates the first owner account + tenant).
  if (pathname === "/api/register") return NextResponse.next();

  // Sandbox demo start — public (provisions an isolated demo tenant).
  // IP rate-limited (5/hr) in the handler; auth happens via the returned creds.
  if (pathname === "/api/demo/start") return NextResponse.next();

  // Super-admin login page — pass through (auth happens at the page level).
  if (isSuperAdminLoginRoute) return NextResponse.next();

  // Other super-admin routes — require session. Role check happens in the layout.
  if (isSuperAdminRoute) {
    if (!sessionToken) {
      return NextResponse.redirect(new URL("/super-admin/login", req.url));
    }
    return NextResponse.next();
  }

  // API routes without auth → 401
  if (!sessionToken && !bearerToken && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Non-authenticated users → redirect to login
  if (!sessionToken && !isLoginRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Authenticated users on login → redirect to dashboard
  if (sessionToken && isLoginRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
