import { ScrollReveal } from "./ScrollReveal";
import { SAAS_HOW_IT_WORKS } from "@/lib/landing-data-saas";

/**
 * Numbered timeline. Three steps as columns separated by hairline dividers,
 * no card boxes, no giant gradient numbers, no connector arrows. The step
 * number is a quiet slate marker, not a decorative gradient.
 */
export function HowItWorks() {
  return (
    <section className="bg-sky-50 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Live dalam 2 menit.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Daftar, isi layanan, buka kasir. Tanpa install, tanpa setting hardware.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={1}>
          <ol className="mt-14 grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-3 md:divide-y-0 md:divide-x">
            {SAAS_HOW_IT_WORKS.map((step) => (
              <li key={step.num} className="px-2 py-8 md:px-8 md:first:pl-0 md:last:pr-0">
                <span className="font-display text-sm font-bold text-brand tabular-nums">
                  {step.num}
                </span>
                <h3 className="mt-3 font-display text-xl font-bold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
                  {step.desc}
                </p>
              </li>
            ))}
          </ol>
        </ScrollReveal>
      </div>
    </section>
  );
}
