import Link from "next/link";
import { Check, X, ArrowRight, Star, ChevronDown } from "lucide-react";
import { BlogFooter, BlogHeader } from "@/components/blog/blog-shell";
import { COMPETITORS, type Competitor } from "@/lib/alternatif-data";
import { SITE_URL as SITE } from "@/lib/site";

// SITE → env-backed SITE_URL (aliased on import from @/lib/site).

const HIVEPOS_CARD_POINTS = [
  "Outlet pertama gratis selamanya",
  "Browser — HP, tablet, PC",
  "Kiloan + WhatsApp order + pickup",
];

export function ComparisonPage({ data }: { data: Competitor }) {
  const url = `${SITE}/${data.slug}`;
  const related = COMPETITORS.filter((c) => c.slug !== data.slug);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: `Alternatif ${data.name} Laundry`, item: url },
    ],
  };

  return (
    <div className="pub-scope flex min-h-screen flex-col bg-white">
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>

      <BlogHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-sky-50/70 to-white">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-6 md:py-24">
            <nav className="flex items-center gap-1.5 text-sm text-slate-400" aria-label="Breadcrumb">
              <Link href="/" className="transition-colors hover:text-slate-700">Beranda</Link>
              <span>/</span>
              <span className="text-slate-600">Alternatif {data.name}</span>
            </nav>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-brand">Perbandingan · Alternatif</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              {data.heroH1}{" "}
              <span className="text-brand">{data.heroHighlight}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{data.dek}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow"
              >
                Coba Gratis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/#harga"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3.5 text-base font-bold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Lihat Harga Lengkap
              </Link>
            </div>
          </div>
        </section>

        {/* Head-to-head pricing */}
        <section className="mx-auto max-w-5xl px-5 py-14 sm:px-6 md:py-20">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-3xl border-2 border-brand bg-white p-8 shadow-sm">
              <span className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                <Star className="h-3 w-3 fill-current" /> Rekomendasi
              </span>
              <p className="font-display text-xl font-extrabold text-slate-900">hivePOS</p>
              <p className="mt-3 text-sm text-slate-500">Mulai dari</p>
              <p className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
                Rp 49K<span className="text-base font-bold text-slate-400">/outlet/bln</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                {HIVEPOS_CARD_POINTS.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-8">
              <p className="font-display text-xl font-extrabold text-slate-500">{data.name}</p>
              <p className="mt-3 text-sm text-slate-400">Mulai dari</p>
              <p className="font-display text-4xl font-extrabold tracking-tight text-slate-400">
                {data.theirPriceFrom}
                <span className="text-base font-bold text-slate-300">{data.theirPriceUnit}</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-500">
                {data.theirCardPoints.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Detailed comparison table */}
        <section className="mx-auto max-w-5xl px-5 pb-4 sm:px-6">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Perbandingan Lengkap hivePOS vs {data.name}
          </h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-4 text-left font-bold text-slate-500">Fitur</th>
                  <th className="border-l-2 border-brand bg-sky-50/50 p-4 text-left font-extrabold text-brand">hivePOS</th>
                  <th className="p-4 text-left font-semibold text-slate-500">{data.name}</th>
                </tr>
              </thead>
              <tbody>
                {data.comparison.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                    <td className="p-4 font-medium text-slate-700">{row.feature}</td>
                    <td className="border-l-2 border-brand/30 bg-sky-50/30 p-4 text-slate-900">
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="h-4 w-4 shrink-0 text-brand" /> {row.hivepos}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={"inline-flex items-center gap-1.5 " + (row.themNeg ? "text-slate-400" : "text-slate-600")}>
                        {row.themNeg && <X className="h-4 w-4 shrink-0 text-slate-300" />}
                        {row.them}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Reasons */}
        <section className="mx-auto max-w-5xl px-5 py-16 sm:px-6 md:py-24">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Kenapa Pindah dari {data.name}?
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {data.reasons.map((r) => (
              <div
                key={r.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-brand/40 hover:shadow-lg"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-brand">
                  <r.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-slate-900">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cross-link other comparisons */}
        <section className="border-y border-slate-200 bg-slate-50/50">
          <div className="mx-auto max-w-5xl px-5 py-14 sm:px-6">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-slate-900">
              Bandingkan dengan alternatif lain
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {related.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${c.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-brand/40 hover:text-brand"
                >
                  Alternatif {c.name} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Panduan terkait — blog cross-link (bidirectional authority with /blog) */}
        <section className="mx-auto max-w-5xl px-5 py-12 sm:px-6">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-slate-900">
            Panduan terkait
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { slug: "cara-hitung-harga-laundry-kiloan", title: "Cara Hitung Harga Laundry Kiloan" },
              { slug: "aplikasi-kasir-laundry-gratis-tanpa-install", title: "Aplikasi Kasir Laundry Gratis Tanpa Install" },
              { slug: "kirim-nota-laundry-via-whatsapp", title: "Kirim Nota Laundry via WhatsApp" },
            ].map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 transition-all hover:border-brand/40 hover:text-brand"
              >
                {p.title}{" "}
                <ArrowRight className="ml-1 inline h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 md:py-24">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Pertanyaan Umum
            </h2>
            <div className="mt-8 space-y-3">
              {data.faqs.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-slate-900">
                    {f.q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-5 py-16 sm:px-6 md:py-20">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-900 px-8 py-12 text-center md:px-16 md:py-16">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Siap pindah dari {data.name}?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-300">
              Coba semua fitur gratis. Outlet pertama gratis selamanya, tanpa kartu kredit.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-slate-900 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
            >
              Daftar Sekarang — Gratis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <BlogFooter />
    </div>
  );
}
