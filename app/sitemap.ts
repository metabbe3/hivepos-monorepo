import type { MetadataRoute } from "next";
import { apiFetch } from "@/modules/shared";

// ponytail: platform URLs stay static; tenant website URLs appended from the API.
// force-dynamic: API isn't reachable at build time, so skip prerender.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://hivepos.id";
  const lastModified = new Date();

  // Public blog posts (Go endpoint pending — PORT-DEBT §2; graceful empty).
  let blogPosts: { slug: string; updatedAt?: string }[] = [];
  try {
    const { data } = await apiFetch<{ slug: string; updatedAt?: string }[]>("/api/public/blog-posts");
    blogPosts = Array.isArray(data) ? data : [];
  } catch {
    blogPosts = [];
  }

  const platformUrls: MetadataRoute.Sitemap = [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/alternatif-moka-pos-laundry`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    // /register intentionally omitted — it's noindex (app/(auth)/layout.tsx), so
    // listing it in the sitemap contradicts the page's own robots directive.
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
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
    url: `https://${t.slug}.hivepos.id/`,
    lastModified: t.websitePublishedAt ?? t.updatedAt ?? lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...platformUrls, ...tenantUrls];
}
