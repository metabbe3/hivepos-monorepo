import type { Metadata } from "next";
import Link from "next/link";
import { LAUNDRY_CITIES } from "@/lib/laundry-cities";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Direktori Laundry hivePOS — Kasir Laundry di Seluruh Indonesia",
  description:
    "Daftar usaha laundry yang menggunakan hivePOS, kasir laundry browser-native, di kota-kota Indonesia. Kelola kiloan, satuan, WhatsApp order, multi-outlet. Coba gratis 1 outlet.",
  alternates: { canonical: "/laundry" },
  openGraph: {
    title: "Direktori Laundry hivePOS",
    description:
      "Usaha laundry ber hivePOS di seluruh Indonesia. Kasir kiloan, WhatsApp order, multi-outlet.",
    url: `${SITE_URL}/laundry`,
    type: "website",
    locale: "id_ID",
  },
};

export default function LaundryDirectoryPage() {
  return (
    <main className="px-5 sm:px-8 py-16 sm:py-20 bg-white min-h-screen">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Direktori Laundry hivePOS
          </h1>
          <p className="mt-3 text-sm text-slate-500 max-w-xl mx-auto">
            Usaha laundry di Indonesia yang menjalankan hivePOS — kasir laundry ringan di browser.
            Pilih kota Anda.
          </p>
        </header>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LAUNDRY_CITIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/laundry/${c.slug}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 text-center font-semibold text-slate-800 transition hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
              >
                Laundry di {c.name}
              </Link>
            </li>
          ))}
        </ul>

        <footer className="mt-12 text-center text-xs text-slate-400">
          <Link href="/" className="font-semibold text-brand-700 hover:underline">
            hivePOS — kasir laundry di browser
          </Link>
        </footer>
      </div>
    </main>
  );
}
