import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BlogFooter, BlogHeader } from "@/components/blog/blog-shell";
import { COMPETITORS } from "@/lib/alternatif-data";
import { SITE_URL as SITE } from "@/lib/site";

// Internal-link hub: de-orphans every /alternatif-*-laundry page from one place,
// and itself targets the broad keyword "alternatif/perbandingan aplikasi kasir laundry".
export const metadata: Metadata = {
  title: "Perbandingan & Alternatif Aplikasi Kasir Laundry | hivePOS",
  description:
    "Bandingkan hivePOS dengan aplikasi kasir laundry populer di Indonesia — Moka POS, Olsera, Majoo, Kasir Pintar, Pawoon, iSeller, Qasir, dan lainnya. Khusus laundry kiloan, outlet pertama gratis.",
  alternates: { canonical: "/alternatif" },
  openGraph: {
    title: "Perbandingan & Alternatif Aplikasi Kasir Laundry | hivePOS",
    description:
      "Bandingkan hivePOS dengan 10+ aplikasi kasir laundry lain. Khusus laundry kiloan, browser-native, outlet pertama gratis selamanya.",
    url: `${SITE}/alternatif`,
    type: "website",
    locale: "id_ID",
  },
};

export default function AlternatifHubPage() {
  return (
    <div className="pub-scope flex min-h-screen flex-col bg-white">
      <BlogHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-sky-50/70 to-white">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-6 md:py-24">
            <nav className="flex items-center gap-1.5 text-sm text-slate-400" aria-label="Breadcrumb">
              <Link href="/" className="transition-colors hover:text-slate-700">Beranda</Link>
              <span>/</span>
              <span className="text-slate-600">Alternatif</span>
            </nav>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-brand">Perbandingan · Alternatif</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
              Alternatif Aplikasi Kasir Laundry —{" "}
              <span className="text-brand">Bandingkan Semua</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
              Bingung memilih aplikasi kasir laundry? Bandingkan hivePOS dengan {COMPETITORS.length} alternatif populer di Indonesia. Khusus laundry kiloan, jalan di browser tanpa install, outlet pertama gratis selamanya.
            </p>
          </div>
        </section>

        {/* Comparison index */}
        <section className="mx-auto max-w-5xl px-5 py-14 sm:px-6 md:py-20">
          <div className="grid gap-4 sm:grid-cols-2">
            {COMPETITORS.map((c) => (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                className="group flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-brand/40 hover:shadow-lg"
              >
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Alternatif {c.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {c.heroHighlight} · kompetitor {c.theirPriceFrom}
                    {c.theirPriceUnit}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-brand" />
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow"
            >
              Coba hivePOS Gratis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <BlogFooter />
    </div>
  );
}
