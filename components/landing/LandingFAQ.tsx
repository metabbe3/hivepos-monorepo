"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";
import { SAAS_FAQS } from "@/lib/landing-data-saas";

/**
 * Single-column accordion, hairline-divided (no per-item card boxes or shadows).
 * Accordion is the right UX for 9 detailed Q&As on mobile; kept minimal.
 */
export function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(1);

  return (
    <section id="faq" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <ScrollReveal>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Pertanyaan sering ditanyakan.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={1}>
          <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
            {SAAS_FAQS.map((faq, i) => {
              const isOpen = openIndex === i;
              const panelId = `saas-faq-panel-${i}`;
              const buttonId = `saas-faq-button-${i}`;
              return (
                <div key={i}>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex((prev) => (prev === i ? null : i))}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <span className="text-base font-bold text-slate-900">{faq.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-brand" : ""
                      }`}
                    />
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={isOpen ? "block" : "hidden"}
                  >
                    <p className="pb-5 pr-8 leading-relaxed text-slate-600">{faq.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
