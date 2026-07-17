import Link from "next/link";
import { Check } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";
import { SAAS_PRICING } from "@/lib/landing-data-saas";

/**
 * Single comparison panel — three columns inside one bordered container with
 * shared hairline dividers, not three floating towers. Pro is emphasized with
 * a brand tint + corner tag (color, not just height). CTAs pinned to the
 * column bottom so they align regardless of feature-list length.
 */
export function PricingSection() {
  return (
    <section id="harga" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Harga jujur, tanpa kontrak.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Per outlet, bukan per user. Semua staff di outlet itu ikut tercakung.
            Upgrade kapan saja.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={1}>
          <div className="mt-12 grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 md:grid-cols-3">
            {SAAS_PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col border-t border-slate-200 p-6 first:border-t-0 sm:p-8 md:border-l md:border-t-0 md:first:border-l-0 ${
                  plan.highlight ? "bg-brand/5" : "bg-white"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute right-0 top-0 bg-brand px-3 py-1 text-[11px] font-bold text-white">
                    Paling Populer
                  </span>
                )}

                <h3 className="font-display text-2xl font-extrabold text-slate-900">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{plan.desc}</p>

                <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {plan.originalPrice && (
                    <span className="font-display text-base font-bold text-slate-400 line-through price">
                      {plan.originalPrice}
                    </span>
                  )}
                  <span className="font-display text-4xl font-extrabold tracking-tight text-slate-900 price">
                    {plan.price}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">{plan.period}</span>
                  {plan.discount && (
                    <span className="rounded bg-brand px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                      {plan.discount}
                    </span>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => {
                    const isUnlimited = /^Unlimited\s/.test(feature);
                    return (
                      <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                        <span className={isUnlimited ? "font-bold text-slate-900" : ""}>
                          {feature}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href="/register"
                  className={`mt-8 block rounded-full py-3 text-center text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.99] ${
                    plan.highlight
                      ? "bg-brand text-white hover:bg-brand-700"
                      : "border border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={2}>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
            Harga per <strong className="font-semibold text-slate-700">outlet</strong>, bukan per
            user. Semua staff di outlet tersebut ikut tercakung. Bisa upgrade kapan saja.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
