import Link from "next/link";
import { BrandMark } from "@/components/public/brand-logo";

// On-brand blog chrome — visually consistent with LandingNav/Footer but uses
// absolute links (the landing anchors #fitur/#harga are dead off the homepage).

const NAV = [
  { href: "/#fitur", label: "Fitur" },
  { href: "/#harga", label: "Harga" },
  { href: "/alternatif-moka-pos-laundry", label: "Alternatif Moka" },
  { href: "/blog", label: "Blog" },
];

export function BlogHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="hivePOS beranda">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <BrandMark className="h-4 w-4" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            hive<span className="text-brand">POS</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/register"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow"
        >
          Daftar Gratis
        </Link>
      </div>
    </header>
  );
}

export function BlogFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
                <BrandMark className="h-4 w-4" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-white">
                hive<span className="text-brand">POS</span>
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Kasir laundry ringan di browser, untuk UMKM Indonesia. Kiloan, satuan, WhatsApp order, multi-outlet.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol
              title="Produk"
              links={[
                { href: "/#fitur", label: "Fitur" },
                { href: "/#harga", label: "Harga" },
                { href: "/alternatif-moka-pos-laundry", label: "Alternatif Kasir" },
              ]}
            />
            <FooterCol
              title="Sumber"
              links={[
                { href: "/blog", label: "Blog" },
                { href: "/terms", label: "Syarat" },
              ]}
            />
            <FooterCol
              title="Mulai"
              links={[
                { href: "/register", label: "Daftar Gratis" },
                { href: "/login", label: "Masuk" },
              ]}
            />
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} hivePOS. Dibuat untuk pelaku usaha laundry Indonesia.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-slate-400 transition-colors hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
