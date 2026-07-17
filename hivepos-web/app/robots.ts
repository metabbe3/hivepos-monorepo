import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api", "/super-admin", "/laundry/orders"],
      },
    ],
    sitemap: "https://hivepos.id/sitemap.xml",
    host: "https://hivepos.id",
  };
}
