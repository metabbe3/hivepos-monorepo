import type { MetadataRoute } from "next";
import { apiFetch } from "@/modules/shared";
import { COMPETITORS } from "@/lib/alternatif-data";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { LAUNDRY_CITIES } from "@/lib/laundry-cities";
import { SITE_URL, SITE_DOMAIN } from "@/lib/site";

// ponytail: platform URLs stay static; tenant website URLs appended from the API.
// force-dynamic: tenant API isn't reachable at build time, so skip prerender.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const lastModified = new Date();

  // Blog posts live in-code (lib/blog-posts.ts) — no API.
  const blogPosts = BLOG_POSTS.map((p) => ({ slug: p.slug, updatedAt: p.publishedAt }));

  const platformUrls: MetadataRoute.Sitemap = [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/alternatif`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...COMPETITORS.map((c) => ({
      url: `${base}/${c.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    // /register intentionally omitted — it's noindex (app/(auth)/layout.tsx), so
    // listing it in the sitemap contradicts the page's own robots directive.
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    // /laundry city directory — programmatic per-city SEO (tenants grouped by address match).
    { url: `${base}/laundry`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    ...LAUNDRY_CITIES.map((c) => ({
      url: `${base}/laundry/${c.slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${base}/blog`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...blogPosts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  // Tenants with public websites (Go endpoint pending — graceful empty).
  let tenants: { slug: string; websitePublishedAt?: string | null; updatedAt?: string }[] = [];
  try {
    const { data } = await apiFetch<
      { slug: string; websitePublishedAt?: string | null; updatedAt?: string }[]
    >("/api/public/tenants");
    tenants = Array.isArray(data) ? data : [];
  } catch {
    tenants = [];
  }

  const tenantUrls: MetadataRoute.Sitemap = tenants.map((t) => ({
    url: `https://${t.slug}.${SITE_DOMAIN}/`,
    lastModified: t.websitePublishedAt ?? t.updatedAt ?? lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...platformUrls, ...tenantUrls];
}
