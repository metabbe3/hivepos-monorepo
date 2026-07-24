import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Disallow-list model (not allowlist): this robots is shared by the apex
        // and every *.hivepos.id tenant subdomain (one Next app behind middleware),
        // so an allowlist would block tenant sites. Every path below is also
        // middleware-stamped noindex — this just tightens crawl budget.
        disallow: [
          "/api",
          "/super-admin",
          "/dashboard",
          "/laundry",
          "/billing",
          "/customers",
          "/branches",
          "/attendance",
          "/reporting",
          "/users",
          "/roles",
          "/tickets",
          "/website",
          "/whatsapp-templates",
          "/printer-settings",
          "/profile",
          "/onboarding",
          "/login",
          "/register",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
