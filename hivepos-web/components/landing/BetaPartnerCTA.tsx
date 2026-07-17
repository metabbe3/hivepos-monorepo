import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

/**
 * Bold full-bleed sky-blue manifesto band — the founder's-laundry story as a
 * confident mid-page color moment (not a timid tint). Oversized white type on
 * sky-600, white CTA. Dogfooding is supporting proof, kept mid-page.
 */
export function BetaPartnerCTA() {
  return (
    <section className="border-y border-sky-100 bg-sky-50 py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-6">
        <ScrollReveal>
          <p className="text-sm font-bold text-sky-700">Dipakai sendiri</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Dibuat di laundry kami, siap untuk laundry Anda.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            hivePOS aktif dipakai di laundry partner kami sejak Juni 2026.{" "}
            <strong className="font-semibold text-slate-900">
              Sudah kami pakai sendiri: 443 pelanggan aktif, 199 order.
            </strong>{" "}
            Tiap fitur kami tes di operasional nyata sebelum dirilis. Gratis 1
            outlet selamanya, dan feedback Anda langsung ke kami, bukan tiket
            support yang hilang.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={1}>
          <div className="mt-10">
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-sky-50 active:scale-[0.98]"
            >
              Mulai Gratis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
