import type { Metadata } from "next";
import Link from "next/link";
import { apiFetch } from "@/modules/shared";
import { estimateReadTime } from "@/lib/blog/render";

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
    url: "https://hivepos.id/blog",
  },
};

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  content: string;
  coverImage?: string | null;
  publishedAt?: string | null;
}

export default async function BlogPage() {
  // Public blog posts from the Go backend. Endpoint pending in hivepos-api
  // (PORT-DEBT §2) — graceful empty until it ships.
  let posts: BlogPost[] = [];
  try {
    const { data } = await apiFetch<BlogPost[]>("/api/public/blog-posts");
    posts = Array.isArray(data) ? data : [];
  } catch {
    posts = [];
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
 <p className="text-sm font-medium text-slate-400">Blog hivePOS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tips &amp; Panduan Bisnis Laundry
          </h1>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            Artikel tentang aplikasi kasir laundry, sistem kiloan, dan tips mengoptimalkan bisnis laundry Anda.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-2xl border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                <span>{estimateReadTime(post.content)} baca</span>
                <span>·</span>
                <time>
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : ""}
                </time>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">{post.title}</h2>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">{post.description}</p>
              <span className="mt-3 inline-block text-sm font-medium text-blue-600">
                Baca selengkapnya →
              </span>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl bg-slate-900 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Siap mulai?</h3>
          <p className="mt-2 text-sm text-slate-300">
            Coba hivePOS gratis — aplikasi kasir laundry browser-native untuk UMKM Indonesia.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Daftar Gratis →
          </Link>
        </div>
      </main>
    </div>
  );
}
