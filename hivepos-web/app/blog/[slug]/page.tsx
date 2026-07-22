import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import parse from "html-react-parser";
import { ArrowLeft, Clock, CalendarDays, MessageCircle } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { renderMarkdown, estimateReadTime } from "@/lib/blog/render";
import { BlogFooter, BlogHeader } from "@/components/blog/blog-shell";
import { ReadingProgress } from "@/components/blog/reading-progress";
import { TableOfContents } from "@/components/blog/table-of-contents";

// force-dynamic: always read from the API at request time.
export const dynamic = "force-dynamic";

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  content: string;
  keywords?: string | null;
  coverImage?: string | null;
  publishedAt?: string | null;
}
interface BlogPostRef {
  slug: string;
  title: string;
  description: string;
  content: string;
  keywords?: string | null;
}

const SITE = "https://hivepos.id";

async function fetchPost(slug: string): Promise<BlogPost | null> {
  try {
    const { data } = await apiFetch<BlogPost>(`/api/public/blog-posts/${slug}`);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | hivePOS Blog`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: `${SITE}/blog/${post.slug}`,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
    keywords: post.keywords
      ? post.keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [],
  };
}

function topic(post: { keywords?: string | null }): string {
  return post.keywords?.split(",")[0]?.trim() || "Bisnis Laundry";
}
function fmtDate(d?: string | null): string {
  return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  const html = renderMarkdown(post.content);
  const readTime = estimateReadTime(post.content);
  const url = `${SITE}/blog/${post.slug}`;
  const tags = post.keywords?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];
  const waShare = `https://wa.me/?text=${encodeURIComponent(`${post.title} — ${url}`)}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { "@type": "Organization", name: "hivePOS" },
    publisher: { "@type": "Organization", name: "hivePOS", url: SITE },
    mainEntityOfPage: url,
    ...(post.coverImage ? { image: [post.coverImage] } : {}),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  let related: BlogPostRef[] = [];
  try {
    const { data } = await apiFetch<BlogPostRef[]>("/api/public/blog-posts");
    related = (Array.isArray(data) ? data : []).filter((r) => r.slug !== slug).slice(0, 3);
  } catch {
    related = [];
  }

  return (
    <div className="pub-scope flex min-h-screen flex-col bg-white">
      <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>

      <ReadingProgress />
      <BlogHeader />

      <main className="flex-1">
        <article>
          {/* Hero */}
          <header className="border-b border-slate-200 bg-gradient-to-b from-sky-50/60 to-white">
            <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 md:py-16">
              <nav className="flex items-center gap-1.5 text-sm text-slate-400" aria-label="Breadcrumb">
                <Link href="/" className="transition-colors hover:text-slate-700">Beranda</Link>
                <span>/</span>
                <Link href="/blog" className="transition-colors hover:text-slate-700">Blog</Link>
              </nav>

              <div className="mt-5">
                <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
                  {topic(post)}
                </span>
              </div>

              <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl md:text-[2.75rem]">
                {post.title}
              </h1>

              <p className="mt-5 text-lg leading-relaxed text-slate-600">{post.description}</p>

              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-[10px] font-bold text-white">hP</span>
                  Tim hivePOS
                </span>
                {post.publishedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" /> {fmtDate(post.publishedAt)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {readTime} baca
                </span>
              </div>
            </div>
          </header>

          {/* Cover */}
          {post.coverImage && (
            <div className="mx-auto max-w-4xl px-5 sm:px-6">
              <img
                src={post.coverImage}
                alt=""
                className="-mt-8 mb-4 aspect-[16/9] w-full rounded-2xl border border-slate-200 object-cover shadow-sm"
              />
            </div>
          )}

          {/* Body + TOC */}
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="flex justify-center gap-12 py-12 md:py-16">
              <div className="w-full max-w-[680px]">
                {/* renderMarkdown returns sanitized HTML with h2 anchor ids; html-react-parser
                    turns it into React elements (scripts can't execute) — safe HTML rendering. */}
                <div className="prose prose-lg prose-slate prose-dropcap max-w-none prose-headings:scroll-mt-24 prose-headings:font-display prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-l-4 prose-h2:border-brand/40 prose-h2:pl-3 prose-h2:text-2xl prose-h2:font-extrabold prose-h2:tracking-tight prose-h2:text-slate-900 prose-p:text-slate-700 prose-p:leading-[1.8] prose-a:font-semibold prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-strong:text-slate-900 prose-li:my-1 prose-ul:my-4 prose-ol:my-4">
                  {parse(html)}
                </div>

                {/* Tags + share */}
                <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
                  {tags.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {tags.map((t) => (
                        <li key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          #{t}
                        </li>
                      ))}
                    </ul>
                  )}
                  <a
                    href={waShare}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4" /> Bagikan
                  </a>
                </div>

                {/* Author card */}
                <div className="mt-8 flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-extrabold text-white">
                    hP
                  </span>
                  <div>
                    <p className="font-display font-bold text-slate-900">Tim hivePOS</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      hivePOS adalah aplikasi kasir laundry browser-native untuk UMKM Indonesia — kiloan, satuan,
                      WhatsApp order, dan multi-outlet. Kami menulis panduan praktis dari pengalaman lapangan.
                    </p>
                    <Link href="/register" className="mt-2 inline-block text-sm font-bold text-brand hover:underline">
                      Coba gratis →
                    </Link>
                  </div>
                </div>
              </div>

              {/* TOC rail (desktop) */}
              <aside className="hidden w-[220px] shrink-0 xl:block">
                <div className="sticky top-24">
                  <TableOfContents />
                </div>
              </aside>
            </div>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <section className="border-t border-slate-200 bg-slate-50/50">
              <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-20">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Artikel Lainnya</h2>
                  <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">
                    Semua artikel <ArrowLeft className="h-4 w-4 rotate-180" />
                  </Link>
                </div>
                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/blog/${r.slug}`}
                      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-brand">{topic(r)}</span>
                      <h3 className="mt-2 font-display text-base font-bold leading-snug text-slate-900 group-hover:text-brand">
                        {r.title}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 line-clamp-2">{r.description}</p>
                      <span className="mt-4 text-xs text-slate-400">{estimateReadTime(r.content)} baca</span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-20">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-900 px-8 py-12 text-center md:px-16 md:py-16">
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Siap kelola laundry Anda lebih rapi?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-slate-300">
                Kasir kiloan otomatis, struk thermal, WhatsApp order, dan laporan penjualan — semua dari browser.
              </p>
              <Link
                href="/register"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-slate-900 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
              >
                Daftar Gratis →
              </Link>
            </div>
          </section>
        </article>
      </main>

      <BlogFooter />
    </div>
  );
}
