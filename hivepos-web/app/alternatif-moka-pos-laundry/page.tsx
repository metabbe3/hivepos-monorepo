import type { Metadata } from "next";
import Link from "next/link";
import { Check, X, ArrowRight, PiggyBank, MonitorSmartphone, Shirt, Globe2, ChevronDown, Star } from "lucide-react";
import { BlogFooter, BlogHeader } from "@/components/blog/blog-shell";

export const metadata: Metadata = {
  title: "Alternatif Moka POS Laundry Termurah | hivePOS Rp 49K/outlet",
  description:
    "Alternatif Moka POS untuk usaha laundry. hivePOS 3.4× lebih murah (Rp 49K vs Rp 169K), browser-native tanpa iPad, khusus laundry kiloan + WhatsApp order. Gratis 1 outlet selamanya.",
  alternates: { canonical: "/alternatif-moka-pos-laundry" },
  openGraph: {
    title: "Alternatif Moka POS Laundry Termurah | hivePOS Rp 49K/outlet",
    description:
      "Alternatif Moka POS untuk usaha laundry. hivePOS 3.4× lebih murah, browser-native tanpa iPad, khusus laundry kiloan + WhatsApp order.",
    url: "https://hivepos.id/alternatif-moka-pos-laundry",
    type: "website",
    locale: "id_ID",
  },
};

const SITE = "https://hivepos.id";

const comparison = [
  { feature: "Harga mulai", hivepos: "Rp 49K/outlet/bulan", moka: "~Rp 169K/bulan", mokaNeg: true },
  { feature: "Outlet pertama", hivepos: "Gratis selamanya", moka: "Berbayar", mokaNeg: true },
  { feature: "Platform", hivepos: "Browser (HP/tablet/PC)", moka: "iPad app + web" },
  { feature: "Butuh hardware?", hivepos: "Tidak", moka: "iPad/tablet", mokaNeg: true },
  { feature: "Khusus laundry (kiloan)", hivepos: "Ya — kiloan, satuan, garment", moka: "Umum (all retail)" },
  { feature: "WhatsApp order", hivepos: "Built-in + template", moka: "Add-on / integrasi", mokaNeg: true },
  { feature: "Cetak struk thermal", hivepos: "BT/USB/WiFi/Browser", moka: "BT/WiFi (butuh iPad)" },
  { feature: "Multi-outlet", hivepos: "Unlimited (Growth+)", moka: "Ya" },
  { feature: "Pickup/antar-jemput", hivepos: "Built-in", moka: "Tidak", mokaNeg: true },
  { feature: "Website laundry", hivepos: "Pro (slug.hivepos.id)", moka: "Tidak", mokaNeg: true },
  { feature: "Bukti foto order", hivepos: "Pro (sebelum/sesudah)", moka: "Tidak", mokaNeg: true },
  { feature: "PWA (install di HP)", hivepos: "Ya, offline mode", moka: "Tidak", mokaNeg: true },
];

const reasons = [
  {
    icon: PiggyBank,
    title: "Hemat 70% per bulan",
    body: "Moka POS ~Rp 169K/bulan. hivePOS Growth Rp 49K/outlet/bulan. Untuk 1 outlet, hemat ~Rp 120K/bulan = Rp 1,44 juta/tahun. Outlet pertama gratis selamanya.",
  },
  {
    icon: MonitorSmartphone,
    title: "Tidak butuh iPad",
    body: "Moka POS butuh iPad (Rp 5–7 juta). hivePOS jalan di HP Android, iPhone, tablet, atau laptop apa saja yang punya browser. Nol investasi hardware.",
  },
  {
    icon: Shirt,
    title: "Khusus laundry, bukan retail umum",
    body: "Moka POS adalah POS retail umum. hivePOS dirancang khusus untuk laundry: kiloan, satuan, garment breakdown (baju, celana, kaos kaki), WhatsApp order otomatis, pickup, dan status tracking.",
  },
  {
    icon: Globe2,
    title: "Website laundry gratis (Pro)",
    body: "Dapatkan website laundry sendiri di slug.hivepos.id dengan SEO lokal Google Maps, tombol WhatsApp order, dan tracking pesanan online. Moka POS tidak punya ini.",
  },
];

const faqs = [
  {
    q: "Apakah hivePOS bisa menggantikan Moka POS sepenuhnya?",
    a: "Ya. hivePOS punya semua yang Moka POS tawarkan untuk laundry (kasir, struk, laporan, multi-outlet) PLUS fitur khusus laundry yang Moka tidak punya: kiloan pricing, WhatsApp order, pickup, garment breakdown, dan website laundry.",
  },
  {
    q: "Susah tidak pindah dari Moka ke hivePOS?",
    a: "Tidak. Kalau Moka Anda bisa export data (pelanggan, layanan, harga), kami bantu import. Kalau tidak, setup layanan + harga di hivePOS cuma butuh 2 menit. Pelanggan bisa diketik saat order pertama.",
  },
  {
    q: "Apakah printer thermal saya bisa dipakai di hivePOS?",
    a: "Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di iPhone/iPad, gunakan WiFi atau Browser Print. Di Android/PC dengan Chrome/Edge, semua metode didukung.",
  },
];

// Mirrors the visible FAQ below so Google can earn rich results.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
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
    { "@type": "ListItem", position: 2, name: "Alternatif Moka POS Laundry", item: `${SITE}/alternatif-moka-pos-laundry` },
  ],
};

export default function AlternatifMokaPage() {
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
              <span className="text-slate-600">Alternatif Moka POS</span>
            </nav>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-brand">Perbandingan · Alternatif</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Alternatif Moka POS untuk Laundry —{" "}
              <span className="text-brand">3,4× Lebih Murah</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
              hivePOS adalah kasir laundry yang jalan langsung di browser — tanpa iPad, tanpa hardware mahal. Khusus
              laundry kiloan dengan WhatsApp order, cetak struk thermal, dan pickup gratis. Mulai{" "}
              <strong className="font-semibold text-slate-900">Rp 49K/outlet</strong> (outlet pertama gratis selamanya).
            </p>

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
            {/* hivePOS — winner */}
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
                {["Outlet pertama gratis selamanya", "Browser — HP, tablet, PC", "Kiloan + WhatsApp order + pickup"].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Moka */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-8">
              <p className="font-display text-xl font-extrabold text-slate-500">Moka POS</p>
              <p className="mt-3 text-sm text-slate-400">Mulai dari</p>
              <p className="font-display text-4xl font-extrabold tracking-tight text-slate-400">
                ~Rp 169K<span className="text-base font-bold text-slate-300">/bln</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-500">
                {["Semua outlet berbayar", "Butuh iPad / tablet", "POS retail umum, add-on WhatsApp"].map((t) => (
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
            Perbandingan Lengkap hivePOS vs Moka POS
          </h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-4 text-left font-bold text-slate-500">Fitur</th>
                  <th className="border-l-2 border-brand bg-sky-50/50 p-4 text-left font-extrabold text-brand">
                    hivePOS
                  </th>
                  <th className="p-4 text-left font-semibold text-slate-500">Moka POS</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                    <td className="p-4 font-medium text-slate-700">{row.feature}</td>
                    <td className="border-l-2 border-brand/30 bg-sky-50/30 p-4 text-slate-900">
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="h-4 w-4 shrink-0 text-brand" /> {row.hivepos}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={"inline-flex items-center gap-1.5 " + (row.mokaNeg ? "text-slate-400" : "text-slate-600")}>
                        {row.mokaNeg && <X className="h-4 w-4 shrink-0 text-slate-300" />}
                        {row.moka}
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
            Kenapa Pindah dari Moka POS?
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {reasons.map((r) => (
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

        {/* FAQ */}
        <section className="border-t border-slate-200 bg-slate-50/50">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 md:py-24">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Pertanyaan Umum
            </h2>
            <div className="mt-8 space-y-3">
              {faqs.map((f) => (
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
              Siap hemat 70% dari Moka POS?
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
