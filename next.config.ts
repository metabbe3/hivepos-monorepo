import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Tree-shake barrel imports so only the icons/charts actually used ship.
    optimizePackageImports: ["lucide-react", "recharts"],
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
