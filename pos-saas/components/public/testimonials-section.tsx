"use client";

import { useState } from "react";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { LANDING_TESTIMONIALS } from "@/lib/landing-data";

export function TestimonialsSection() {
  const [startIndex, setStartIndex] = useState(0);

  const testimonials = LANDING_TESTIMONIALS;
  const visibleCount = 3;
  const maxStart = Math.max(0, testimonials.length - visibleCount);

  function prev() {
    setStartIndex((i) => Math.max(0, i - 1));
  }

  function next() {
    setStartIndex((i) => Math.min(maxStart, i + 1));
  }

  return (
    <section className="relative overflow-hidden px-5 sm:px-8 py-20 sm:py-28 bg-white">
      {/* Decorative */}
      <div className="pointer-events-none absolute -top-20 right-0 h-[400px] w-[400px] rounded-full bg-brand/5 blur-[100px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-brand">
            Testimoni
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Apa Kata Mereka
          </h2>
        </div>

        {/* Desktop: grid with arrows */}
        <div className="relative hidden sm:block">
          <div className="grid grid-cols-3 gap-6">
            {testimonials.slice(startIndex, startIndex + visibleCount).map((t, i) => (
              <TestimonialCard key={t.name} {...t} index={i} />
            ))}
          </div>
          {startIndex > 0 && (
            <button
              type="button"
              onClick={prev}
              className="absolute -left-5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-brand shadow-lg transition-all hover:-translate-x-0.5 hover:border-brand hover:bg-brand hover:text-white hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              aria-label="Testimoni sebelumnya"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {startIndex < maxStart && (
            <button
              type="button"
              onClick={next}
              className="absolute -right-5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-brand shadow-lg transition-all hover:translate-x-0.5 hover:border-brand hover:bg-brand hover:text-white hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              aria-label="Testimoni berikutnya"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Mobile: horizontal scroll with snap */}
        <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 sm:hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {testimonials.map((t, i) => (
            <div key={t.name} className="min-w-[300px] snap-center">
              <TestimonialCard {...t} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({
  name,
  role,
  text,
  rating,
}: {
  name: string;
  role: string;
  text: string;
  rating: number;
  index?: number;
}) {
  return (
    <div className="group relative h-full rounded-3xl bg-white border border-slate-100 p-7 shadow-lg shadow-slate-900/5 transition-all duration-300 hover:shadow-xl hover:shadow-brand/5 hover:-translate-y-1">
      {/* Quote icon */}
      <div className="absolute top-5 right-5 text-brand/10 transition-colors group-hover:text-brand/20">
        <Quote className="h-10 w-10" />
      </div>

      {/* Stars */}
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-200 text-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Text */}
      <p className="mt-5 text-sm leading-relaxed text-slate-600">
        &ldquo;{text}&rdquo;
      </p>

      {/* Author */}
      <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-amber-500 text-sm font-bold text-white shadow-md shadow-brand/20">
          {name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{name}</p>
          <p className="text-xs text-slate-400">{role}</p>
        </div>
      </div>
    </div>
  );
}
