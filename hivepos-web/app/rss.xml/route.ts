import { BLOG_POSTS } from "@/lib/blog-posts";
import { SITE_URL } from "@/lib/site";

// RSS 2.0 feed for the blog (feed-reader autodiscovery via layout metadata alternates).
// ponytail: static — built once from the in-code BLOG_POSTS; rebuild on post edits.
export const dynamic = "force-static";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      default: return "&quot;";
    }
  });
}

export async function GET() {
  const items = BLOG_POSTS.map((p) => {
    const url = `${SITE_URL}/blog/${p.slug}`;
    return [
      "    <item>",
      `      <title>${escapeXml(p.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid>${url}</guid>`,
      `      <description>${escapeXml(p.description)}</description>`,
      `      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>`,
      "    </item>",
    ].join("\n");
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog hivePOS</title>
    <link>${SITE_URL}/blog</link>
    <description>Tips dan panduan bisnis laundry untuk UMKM Indonesia.</description>
    <language>id-id</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
