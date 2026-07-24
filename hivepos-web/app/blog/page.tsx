import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { estimateReadTime } from "@/lib/blog/render";
import { BlogFooter, BlogHeader } from "@/components/blog/blog-shell";
import { SITE_URL } from "@/lib/site";

// force-dynamic: always read from the API at request time — new/edited posts appear
// immediately with no rebuild.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog hivePOS — Tips & Panduan Bisnis Laundry | hivePOS",
  description:
    "Artikel dan panduan tentang aplikasi kasir laundry, sistem kiloan, tips bisnis laundry, dan perbandingan software POS untuk UMKM Indonesia.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog hivePOS — Tips Bisnis Laundry",
    description: "Panduan aplikasi kasir laundry, sistem kiloan, dan tips optimasi bisnis laundry.",
    url: `${SITE_URL}/blog`,
    type: "website",
    locale: "id_ID",
  },
};

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  content: string;
  keywords?: string | null;
  coverImage?: string | null;
  publishedAt?: string | null;
}

function topic(post: BlogPost): string {
  return post.keywords?.split(",")[0]?.trim() || "Bisnis Laundry";
}

function fmtDate(d?: string | null): string {
  return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default async function BlogPage() {
  // Public blog posts from the Go backend (served by the public_api module).
  let posts: BlogPost[] = [];
  try {
    const { data } = await apiFetch<BlogPost[]>("/api/public/blog-posts");
    posts = Array.isArray(data) ? data : [];
  } catch {
    posts = [];
  }

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="pub-scope flex min-h-screen flex-col bg-white">
      <BlogHeader />

      <main className="flex-1">
        {/* Masthead */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-sky-50/70 to-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Blog · hivePOS</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Tips &amp; Panduan Bisnis Laundry
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Modal, harga per kilo, SOP harian, dan cara memilih aplikasi kasir laundry — ditulis praktis untuk pelaku
              usaha laundry Indonesia.
            </p>
            {posts.length > 0 && (
              <p className="mt-6 text-sm font-medium text-slate-400">{posts.length} artikel tersedia</p>
            )}
          </div>
        </section>

        {/* Posts */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-20">
          {posts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-20 text-center">
              <p className="font-display text-xl font-bold text-slate-900">Belum ada artikel</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                Artikel blog akan tampil di sini. Sementara itu, coba hivePOS gratis untuk outlet pertama Anda.
              </p>
              <Link
                href="/register"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow"
              >
                Daftar Gratis →
              </Link>
            </div>
          ) : (
            <>
              {/* Featured */}
              {featured && (
                <Link
                  href={`/blog/${featured.slug}`}
                  className="group grid overflow-hidden rounded-3xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-xl md:grid-cols-2"
                >
                  <div className="relative flex min-h-[220px] flex-col justify-between bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 p-8 text-white">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
                      <Star className="h-3.5 w-3.5 fill-current" /> Unggulan
                    </span>
                    <span className="font-display text-7xl font-extrabold leading-none text-white/25">
                      {topic(featured).slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center p-8 md:p-10">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 font-semibold text-brand">{topic(featured)}</span>
                      <span>·</span>
                      <span>{estimateReadTime(featured.content)} baca</span>
                      {featured.publishedAt && (
                        <>
                          <span>·</span>
                          <time>{fmtDate(featured.publishedAt)}</time>
                        </>
                      )}
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-extrabold leading-tight tracking-tight text-slate-900 group-hover:text-brand sm:text-3xl">
                      {featured.title}
                    </h2>
                    <p className="mt-3 leading-relaxed text-slate-600">{featured.description}</p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                      Baca artikel
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </span>
                  </div>
                </Link>
              )}

              {/* Grid */}
              {rest.length > 0 && (
                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                        <span className="rounded-full bg-sky-50 px-2.5 py-0.5 font-semibold text-brand">{topic(post)}</span>
                      </div>
                      <h3 className="mt-3 font-display text-lg font-bold leading-snug tracking-tight text-slate-900 group-hover:text-brand">
                        {post.title}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 line-clamp-3">{post.description}</p>
                      <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
                        <span>{estimateReadTime(post.content)} baca</span>
                        {post.publishedAt && <time>{fmtDate(post.publishedAt)}</time>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-900 px-8 py-12 text-center md:px-16 md:py-16">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Jalankan outlet laundry pertama Anda hari ini
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-300">
              Aplikasi kasir laundry browser-native. Gratis 1 outlet, tanpa instalasi, tanpa kartu kredit.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-slate-900 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
            >
              Daftar Gratis →
            </Link>
          </div>
        </section>
      </main>

      <BlogFooter />
    </div>
  );
}
