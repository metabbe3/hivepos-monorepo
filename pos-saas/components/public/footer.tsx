import Link from "next/link";

const FOOTER_LINKS = {
  navigasi: [
    { href: "/#layanan", label: "Layanan Kami" },
    { href: "/#lacak", label: "Lacak Pesanan" },
    { href: "/#lokasi", label: "Lokasi" },
    { href: "/#faq", label: "FAQ" },
  ],
};

export function PublicFooter() {
  return (
    <footer className="relative overflow-hidden bg-slate-950 text-slate-300">
      {/* Decorative top gradient line */}
      <div className="h-1 bg-gradient-to-r from-brand via-amber-500 to-brand" />

      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-amber-600 shadow-lg shadow-brand/20 transition-transform group-hover:scale-105">
                <svg viewBox="0 0 40 40" fill="none" className="h-6 w-6">
                  <ellipse cx="13" cy="14" rx="6.5" ry="9" fill="white" fillOpacity="0.9" />
                  <ellipse cx="27" cy="14" rx="6.5" ry="9" fill="white" fillOpacity="0.9" />
                  <ellipse cx="13" cy="14" rx="4.5" ry="6.5" fill="white" fillOpacity="0.4" />
                  <ellipse cx="27" cy="14" rx="4.5" ry="6.5" fill="white" fillOpacity="0.4" />
                  <ellipse cx="20" cy="24" rx="8" ry="11" fill="#FDE047" />
                  <rect x="12" y="19" width="16" height="2.5" rx="1.25" fill="#1E293B" />
                  <rect x="12" y="24" width="16" height="2.5" rx="1.25" fill="#1E293B" />
                  <rect x="13" y="29" width="14" height="2" rx="1" fill="#1E293B" />
                  <circle cx="20" cy="12" r="4" fill="#1E293B" />
                  <circle cx="18.5" cy="11.5" r="1" fill="white" />
                  <circle cx="21.5" cy="11.5" r="1" fill="white" />
                  <path d="M17 9 Q15 4 13 3" stroke="#1E293B" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M23 9 Q25 4 27 3" stroke="#1E293B" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="13" cy="3" r="1" fill="#1E293B" />
                  <circle cx="27" cy="3" r="1" fill="#1E293B" />
                  <path d="M20 35 L19 37.5 L20 36.5 L21 37.5 Z" fill="#1E293B" />
                </svg>
              </div>
              <span className="font-serif text-lg font-bold text-white">
                hivePOS
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-slate-500 leading-relaxed">
              Layanan laundry premium antar jemput di Kemayoran, Jakarta Pusat. Cuci kiloan, sepatu, bedcover dengan harga terjangkau.
            </p>
          </div>

          {/* Navigasi */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-white">
              Navigasi
            </h3>
            <ul className="mt-4 space-y-3">
              {FOOTER_LINKS.navigasi.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontak */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-white">
              Hubungi Kami
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/#lokasi"
                  className="text-sm text-slate-500 transition-colors hover:text-brand"
                >
                  Lokasi & Jam Operasional
                </Link>
              </li>
              <li>
                <Link
                  href="/#lacak"
                  className="text-sm text-slate-500 transition-colors hover:text-brand"
                >
                  Lacak Pesanan
                </Link>
              </li>
            </ul>

            {/* CTA */}
            <a
              href="#estimasi"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand to-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Pesan via WhatsApp
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-center gap-3 border-t border-slate-800/50 pt-8 sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} hivePOS. Hak cipta dilindungi.
          </p>
          <p className="text-xs text-slate-700">
            proudly powered by hivePOS
          </p>
        </div>
      </div>
    </footer>
  );
}
