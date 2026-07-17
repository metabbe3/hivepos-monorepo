import { Check } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";
import { SAAS_INDUSTRIES } from "@/lib/landing-data-saas";

/**
 * Honest single-focus band. SAAS_INDUSTRIES has exactly ONE entry (Laundry),
 * so a 3-up grid would ship empty cells. Instead: a full-width statement +
 * 2-column checklist of the laundry module's real capabilities.
 * On-brand: "fokus kami laundry" reads as anti-bloat, not as a gap.
 */
export function IndustriesSection() {
  const laundry = SAAS_INDUSTRIES[0];

  return (
    <section id="modul" className="bg-sky-50 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
          {/* Statement */}
          <ScrollReveal className="md:col-span-5">
            <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              Fokus kami satu: laundry UMKM.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
              Bukan POS serbaguna yang jadi lintang. hivePOS cuma untuk laundry
              kiloan dan satuan, dirancang untuk 1 sampai 5 outlet. Pas, tidak
              berlebihan.
            </p>
            <p className="mt-4 text-sm font-semibold text-brand">
              {laundry.tagline}
            </p>
          </ScrollReveal>

          {/* Checklist */}
          <ScrollReveal delay={1} className="md:col-span-7">
            <ul className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {laundry.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 border-t border-slate-200 pt-4 text-sm text-slate-700"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
