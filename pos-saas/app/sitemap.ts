import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

// ponytail: platform URLs stay static; tenant website URLs appended from DB.
// force-dynamic: DB isn't reachable at build time, so skip prerender.
// Cached per-request at the CDN layer instead.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://hivepos.id";
  const lastModified = new Date();

  const blogPosts = await prisma.blogPost.findMany({
    where: { published: true, publishedAt: { lte: lastModified } },
    select: { slug: true, updatedAt: true },
  });

  // ponytail: marketing service routes deleted — tenants now own that content
  // on their own subdomains. Root + tenant subdomains only.
  const platformUrls: MetadataRoute.Sitemap = [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/alternatif-moka-pos-laundry`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    // /register intentionally omitted — it's noindex (app/(auth)/layout.tsx), so
    // listing it in the sitemap contradicts the page's own robots directive.
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/blog`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...blogPosts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  const tenants = await prisma.tenant.findMany({
    where: { websiteEnabled: true },
    select: { slug: true, websitePublishedAt: true, updatedAt: true },
  });

  const tenantUrls: MetadataRoute.Sitemap = tenants.map((t) => ({
    url: `https://${t.slug}.hivepos.id/`,
    lastModified: t.websitePublishedAt ?? t.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...platformUrls, ...tenantUrls];
}
