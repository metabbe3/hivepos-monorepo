import type { Metadata } from "next";
import Link from "next/link";

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
    type: "article",
  },
};

// Mirrors the visible <details> FAQ below so Google can earn rich results; keep
// the answers in sync with the on-page text.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Apakah hivePOS bisa menggantikan Moka POS sepenuhnya?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ya. hivePOS punya semua yang Moka POS tawarkan untuk laundry (kasir, struk, laporan, multi-outlet) PLUS fitur khusus laundry yang Moka tidak punya: kiloan pricing, WhatsApp order, pickup, garment breakdown, dan website laundry.",
      },
    },
    {
      "@type": "Question",
      name: "Susah tidak pindah dari Moka ke hivePOS?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tidak. Kalau Moka Anda bisa export data (pelanggan, layanan, harga), kami bantu import. Kalau tidak, setup layanan + harga di hivePOS cuma butuh 2 menit. Pelanggan bisa diketik saat order pertama.",
      },
    },
    {
      "@type": "Question",
      name: "Apakah printer thermal saya bisa dipakai di hivePOS?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di iPhone/iPad, gunakan WiFi atau Browser Print. Di Android/PC dengan Chrome/Edge, semua metode didukung.",
      },
    },
  ],
};

export default function AlternatifMokaPage() {
  const comparison = [
    { feature: "Harga mulai", hivepos: "Rp 49K/outlet/bulan", moka: "~Rp 169K/bulan" },
    { feature: "Outlet pertama", hivepos: "Gratis selamanya", moka: "Berbayar" },
    { feature: "Platform", hivepos: "Browser (HP/tablet/PC)", moka: "iPad app + web" },
    { feature: "Butuh hardware?", hivepos: "Tidak", moka: "iPad/tablet" },
    { feature: "Khusus laundry (kiloan)", hivepos: "Ya — kiloan, satuan, garment", moka: "Umum (all retail)" },
    { feature: "WhatsApp order", hivepos: "Built-in + template", moka: "Add-on / integrasi" },
    { feature: "Cetak struk thermal", hivepos: "BT/USB/WiFi/Browser", moka: "BT/WiFi (butuh iPad)" },
    { feature: "Multi-outlet", hivepos: "Unlimited (Growth+)", moka: "Ya" },
    { feature: "Pickup/antar-jemput", hivepos: "Built-in", moka: "Tidak" },
    { feature: "Website laundry", hivepos: "Pro (slug.hivepos.id)", moka: "Tidak" },
    { feature: "Bukti foto order", hivepos: "Pro (sebelum/sesudah)", moka: "Tidak" },
    { feature: "PWA (install di HP)", hivepos: "Ya, offline mode", moka: "Tidak" },
  ];

  return (
    <div className="pub-scope min-h-screen bg-[var(--color-background)]">
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline mb-8">
          ← Kembali ke Beranda
        </Link>

        <h1 className="font-bold text-3xl sm:text-4xl tracking-tight mb-4">
          Alternatif Moka POS untuk Laundry —{" "}
          <span className="text-[var(--color-primary)]">3.4× Lebih Murah</span>
        </h1>
        <p className="text-lg text-[var(--color-muted-foreground)] mb-8">
          hivePOS adalah kasir laundry yang jalan langsung di browser — tanpa iPad,
          tanpa hardware mahal. Khusus laundry kiloan dengan WhatsApp order, cetak struk
          thermal, dan pickup gratis. Mulai <strong>Rp 49K/outlet</strong> (outlet pertama
          gratis selamanya).
        </p>

        <div className="flex flex-wrap gap-3 mb-12">
          <a href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold text-white shadow-lg transition hover:brightness-95">
            Coba Gratis 14 Hari →
          </a>
          <a href="/#harga" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-6 py-3 font-semibold hover:bg-[var(--color-muted)] transition">
            Lihat Harga Lengkap
          </a>
        </div>

        <h2 className="font-bold text-2xl mb-4">hivePOS vs Moka POS</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] mb-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="text-left p-3 font-semibold">Fitur</th>
                <th className="text-left p-3 font-semibold text-[var(--color-primary)]">hivePOS</th>
                <th className="text-left p-3 font-semibold">Moka POS</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-[var(--color-muted)]/30"}>
                  <td className="p-3 font-medium">{row.feature}</td>
                  <td className="p-3"><span className="inline-flex items-center gap-1"><span className="text-emerald-600">✓</span>{row.hivepos}</span></td>
                  <td className="p-3 text-[var(--color-muted-foreground)]">{row.moka}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="font-bold text-2xl mb-4">Kenapa Pindah dari Moka POS?</h2>
        <div className="space-y-4 mb-12">
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <h3 className="font-bold mb-1">Hemat 70% per bulan</h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Moka POS ~Rp 169K/bulan. hivePOS Growth Rp 49K/outlet/bulan. Untuk 1 outlet,
              hemat ~Rp 120K/bulan = Rp 1.44 juta/tahun. Outlet pertama gratis selamanya.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <h3 className="font-bold mb-1">Tidak butuh iPad</h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Moka POS butuh iPad (Rp 5–7 juta). hivePOS jalan di HP Android, iPhone, tablet,
              atau laptop apa saja yang punya browser. Nol investasi hardware.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <h3 className="font-bold mb-1">Khusus laundry, bukan retail umum</h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Moka POS adalah POS retail umum. hivePOS dirancang khusus untuk laundry: kiloan,
              satuan, garment breakdown (baju, celana, kaos kaki), WhatsApp order otomatis,
              pickup/antar-jemput, dan status tracking untuk pelanggan.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <h3 className="font-bold mb-1">Website laundry gratis (Pro)</h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Dapatkan website laundry sendiri di slug.hivepos.id dengan SEO lokal Google Maps,
              tombol WhatsApp order, dan tracking pesanan online. Moka POS tidak punya ini.
            </p>
          </div>
        </div>

        <h2 className="font-bold text-2xl mb-4">Pertanyaan Umum</h2>
        <div className="space-y-3 mb-12">
          <details className="rounded-xl border border-[var(--color-border)] p-4">
            <summary className="font-semibold cursor-pointer">Apakah hivePOS bisa menggantikan Moka POS sepenuhnya?</summary>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Ya. hivePOS punya semua yang Moka POS tawarkan untuk laundry (kasir, struk, laporan, multi-outlet) PLUS fitur khusus laundry yang Moka tidak punya: kiloan pricing, WhatsApp order, pickup, garment breakdown, dan website laundry.</p>
          </details>
          <details className="rounded-xl border border-[var(--color-border)] p-4">
            <summary className="font-semibold cursor-pointer">Susah tidak pindah dari Moka ke hivePOS?</summary>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Tidak. Kalau Moka Anda bisa export data (pelanggan, layanan, harga), kami bantu import. Kalau tidak, setup layanan + harga di hivePOS cuma butuh 2 menit. Pelanggan bisa diketik saat order pertama.</p>
          </details>
          <details className="rounded-xl border border-[var(--color-border)] p-4">
            <summary className="font-semibold cursor-pointer">Apakah printer thermal saya bisa dipakai di hivePOS?</summary>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di iPhone/iPad, gunakan WiFi atau Browser Print. Di Android/PC dengan Chrome/Edge, semua metode didukung.</p>
          </details>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-indigo-700 p-8 text-center text-white">
          <h2 className="font-bold text-2xl mb-2">Siap Hemat 70% dari Moka POS?</h2>
          <p className="text-white/80 mb-4">Coba semua fitur Pro gratis 14 hari. Tanpa kartu kredit.</p>
          <a href="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 font-bold text-[var(--color-primary)] shadow-lg transition hover:bg-white/90">
            Daftar Sekarang — Gratis
          </a>
        </div>
      </div>
    </div>
  );
}
