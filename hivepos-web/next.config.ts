import type { NextConfig } from "next";

// Content-Security-Policy. Locks connect/frame/object/base so XSS can't exfiltrate or be framed,
// while allowing the legit third parties: Midtrans Snap (sandbox + prod) + Google Analytics (gtag).
// ponytail: script-src 'unsafe-inline' covers the Next runtime + inline gtag — upgrade to per-request
// nonces (middleware generateNonce) when tightening XSS mitigation. 'unsafe-eval' is dev-only (HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""} https://*.midtrans.com https://www.googletagmanager.com https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.midtrans.com https://*.google-analytics.com https://*.googletagmanager.com https://cloudflareinsights.com",
  "frame-src 'self' https://*.midtrans.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.midtrans.com",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // ponytail: hostname "**" = open /_next/image proxy (anyone can fetch+transform arbitrary
    // https imgs). Acceptable: low-traffic site, CSP already allows any https img. Upgrade path:
    // curated host list or move uploads to owned storage (R2), then restrict remotePatterns.
  },
  experimental: {
    // Tree-shake barrel imports so only the icons/charts actually used ship.
    optimizePackageImports: ["lucide-react", "recharts"],
    // Minify CSS via Lightning CSS (transpile + shorten). Shrinks the
    // render-blocking global chunk further after route-scoping heavy plugins.
    useLightningcss: true,
  },
  async rewrites() {
    // Dev safety net: route relative /api/* → Go so pages still using raw fetch("/api/...")
    // (not yet on apiFetch) reach the backend instead of 404ing on the web origin. Only active
    // when NEXT_PUBLIC_API_BASE_URL is absolute (direct to Go). In prod, Caddy same-origin
    // handles /api — no rewrite (relative base). Authed raw-fetches still need apiFetch for Bearer.
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
    if (!/^https?:\/\//.test(base)) return [];
    return [{ source: "/api/:path*", destination: `${base}/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
