import Link from "next/link";
import { BrandMark } from "@/components/public/brand-logo";

const PRODUCT_LINKS = [
  { href: "#fitur", label: "Fitur" },
  { href: "#modul", label: "Modul" },
  { href: "#harga", label: "Harga" },
  { href: "#faq", label: "FAQ" },
  { href: "/alternatif-moka-pos-laundry", label: "Alternatif Kasir Laundry" },
];

const START_LINKS = [
  { href: "/register", label: "Mulai Gratis" },
  { href: "/login", label: "Masuk" },
  { href: "/track", label: "Lacak Order" },
  { href: "/blog", label: "Blog" },
];

function IndonesianFlag() {
  return (
    <span
      className="inline-flex h-3.5 w-5 overflow-hidden rounded-sm border border-slate-600 align-middle"
      aria-label="Indonesia"
    >
      <span className="block h-1/2 w-full bg-red-600" />
      <span className="block h-1/2 w-full bg-white" />
    </span>
  );
}

/**
 * Simplified footer: brand + two link groups (was four). Dark surface frames
 * the page. One accent on the wordmark + flag.
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
                <BrandMark className="h-4 w-4" />
              </span>
              hive<span className="text-brand">POS</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Kasir laundry ringan, langsung di browser. Untuk UMKM yang ingin
              mulai hari ini, bukan bulan depan.
            </p>
          </div>

          {/* Produk */}
          <div>
            <h4 className="text-xs font-bold text-slate-500">Produk</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Mulai */}
          <div>
            <h4 className="text-xs font-bold text-slate-500">Mulai</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {START_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 md:flex-row">
          <p className="text-sm text-slate-500">© 2026 hivePOS. Aplikasi Kasir Laundry.</p>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            Dibuat di Indonesia <IndonesianFlag />
          </p>
        </div>
      </div>
    </footer>
  );
}
