import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import parse from "html-react-parser";
import { prisma } from "@/lib/prisma";
import { renderMarkdown, estimateReadTime } from "@/lib/blog/render";

// force-dynamic: always read from DB at request time — new/edited posts appear
// immediately with no rebuild (and no build-time DB access).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) return {};
  return {
    title: `${post.title} | hivePOS Blog`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: `https://hivepos.id/blog/${post.slug}`,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
    keywords: post.keywords
      ? post.keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [],
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) notFound();

  const html = renderMarkdown(post.content);
  const readTime = estimateReadTime(post.content);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt?.toISOString(),
    author: { "@type": "Organization", name: "hivePOS" },
    publisher: { "@type": "Organization", name: "hivePOS", url: "https://hivepos.id" },
    ...(post.coverImage ? { image: [post.coverImage] } : {}),
  };

  const related = await prisma.blogPost.findMany({
    where: {
      published: true,
      slug: { not: slug },
      publishedAt: { lte: new Date() },
    },
    take: 3,
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, description: true },
  });

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-2xl px-4 py-12">
            <Link href="/blog" className="text-sm text-slate-500 hover:text-slate-900">
              ← Blog
            </Link>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {post.title}
            </h1>
            <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
              <span>hivePOS</span>
              <span>·</span>
              <span>{readTime} baca</span>
              {post.publishedAt && (
                <>
                  <span>·</span>
                  <time>
                    {new Date(post.publishedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-2xl px-4 py-10">
          {post.coverImage && (
            <img
              src={post.coverImage}
              alt=""
              className="mb-8 w-full rounded-2xl border border-slate-200 object-cover"
            />
          )}
          {/* renderMarkdown returns sanitized HTML; html-react-parser turns it into
              React elements (scripts can't execute) — safe HTML rendering. */}
          <article className="prose prose-slate max-w-none prose-headings:scroll-mt-20 prose-h2:text-xl prose-h2:font-semibold prose-h2:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-a:text-blue-600 prose-img:rounded-xl">
            {parse(html)}
          </article>

          {/* CTA */}
          <div className="mt-12 rounded-2xl bg-slate-900 p-8 text-center">
            <h3 className="text-lg font-semibold text-white">Coba hivePOS Gratis</h3>
            <p className="mt-2 text-sm text-slate-300">
              Aplikasi kasir laundry browser-native. Gratis 1 outlet, tanpa instalasi.
            </p>
            <Link
              href="/register"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Daftar Sekarang →
            </Link>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <div className="mt-12">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Artikel Lainnya
              </h3>
              <div className="space-y-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="block rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-900">{r.title}</p>
                    <p className="text-sm text-slate-500 mt-1">{r.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
