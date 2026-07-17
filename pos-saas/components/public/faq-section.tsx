"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { LANDING_FAQS } from "@/lib/landing-data";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <section id="faq" className="relative overflow-hidden bg-surface-muted px-5 py-20 sm:px-8 sm:py-28">
      <div className="relative mx-auto max-w-3xl">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm border border-brand/10 px-4 py-2 mb-4">
            <HelpCircle className="h-3.5 w-3.5 text-brand" />
            <span className="text-xs font-semibold uppercase tracking-wider text-brand">
              FAQ
            </span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Pertanyaan Umum
          </h2>
          <p className="mt-3 text-slate-500">
            Temukan jawaban untuk pertanyaan yang sering ditanyakan.
          </p>
        </div>
        <div className="space-y-3">
          {LANDING_FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            const panelId = `faq-panel-${i}`;
            const buttonId = `faq-button-${i}`;

            return (
              <div
                key={i}
                className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
                  isOpen
                    ? "border-brand/20 bg-white shadow-lg shadow-brand/5"
                    : "border-slate-200 bg-white shadow-md shadow-slate-900/5 hover:shadow-lg hover:border-slate-300"
                }`}
              >
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                >
                  <span className={`text-sm font-bold transition-colors ${isOpen ? "text-brand" : "text-foreground"}`}>
                    {faq.question}
                  </span>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${isOpen ? "bg-brand/10 rotate-180" : "bg-slate-100"}`}>
                    <ChevronDown
                      className={`h-4 w-4 transition-colors duration-300 ${
                        isOpen ? "text-brand" : "text-slate-400"
                      }`}
                    />
                  </div>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={`grid transition-all duration-300 ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-sm leading-relaxed text-slate-500">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
