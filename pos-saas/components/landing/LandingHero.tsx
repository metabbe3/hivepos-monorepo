import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";
import { PosPreview } from "./pos-preview";

/**
 * Bold sky-blue hero. Oversized display type, sky emphasis on the hook line,
 * the POS preview framed in a sky-tinted panel. White-dominant, sky as the
 * confident accent. Static paint for LCP. Server component.
 */
export function LandingHero() {
  return (
    <section className="border-b border-sky-100 bg-white">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:pt-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-12">
          {/* Left — oversized value prop */}
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Globe className="h-3.5 w-3.5" />
              Browser-native, tanpa install
            </span>

            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Kasir laundry,{" "}
              <br />
              <span className="text-sky-600">tinggal buka browser.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Ganti buku kasir manual dengan kasir digital yang tinggal buka
              browser. Catat order kiloan, terima QRIS, cetak struk — semua di
              satu tab, tanpa install.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                Mulai Gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-300 bg-white px-7 py-3.5 text-base font-bold text-sky-700 transition-all hover:border-sky-400 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Lihat Demo
              </Link>
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500">
              Gratis 1 outlet (sampai 100 order/bulan). Tanpa kartu kredit.
            </p>
          </div>

          {/* Right — real POS preview on a sky-tinted panel */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 lg:mt-8">
              <PosPreview />
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              Tampilan asli dari Honey Bee Laundry, laundry kami sendiri.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
