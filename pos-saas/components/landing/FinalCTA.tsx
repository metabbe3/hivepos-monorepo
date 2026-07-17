import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

/**
 * Solid brand-accent close. No animated mesh, no glass orbs, no dot grid.
 * One primary CTA (register) + one WhatsApp secondary. The single accent moment.
 */
export function FinalCTA() {
  return (
    <section className="bg-sky-700 py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-5 text-center sm:px-6">
        <ScrollReveal>
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Buka browser. Kasir jalan.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/85">
            Gratis 1 outlet selamanya, tanpa kartu kredit. Mulai hari ini, bukan
            bulan depan.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={1}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-brand shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand active:scale-[0.98] sm:w-auto"
            >
              Mulai Gratis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/demo"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/40 px-8 py-3.5 text-base font-bold text-white transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              Lihat Demo
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/70">
            atau{" "}
            <a
              href="https://wa.me/6285121309381?text=Halo%20saya%20tertarik%20dengan%20hivePOS"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white underline-offset-2 hover:underline"
            >
              chat kami di WhatsApp
            </a>
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
