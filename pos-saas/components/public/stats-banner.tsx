"use client";

import { useEffect, useRef, useState } from "react";
import { LANDING_STATS } from "@/lib/landing-data";

/**
 * Count-up animation for numeric stat values.
 * Extracts the numeric portion and animates from 0 → target.
 * Preserves any prefix/suffix (e.g. "500+", "98%", "3+").
 */
function StatValue({ value }: { value: string }) {
  const [ref, isVisible] = useInView();
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isVisible) return;

    // Parse the value: prefix + number + suffix
    const match = value.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
    if (!match) {
      setDisplay(value);
      return;
    }

    const [, prefix, numStr, suffix] = match;
    const target = parseFloat(numStr);
    const isDecimal = numStr.includes(".");
    const duration = 1500;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      setDisplay(
        prefix +
          (isDecimal ? current.toFixed(1) : Math.round(current).toString()) +
          suffix
      );
      if (progress < 1) requestAnimationFrame(tick);
    }

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  return (
    <span ref={ref} className="tabular-nums">
      {display}
    </span>
  );
}

/** Minimal IntersectionObserver hook for count-up */
function useInView<T extends HTMLElement = HTMLSpanElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  return [ref, inView] as const;
}

export function StatsBanner() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-5 py-16 sm:px-8 sm:py-20">
      {/* Decorative elements — amber brand now resolves */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-brand)_0%,_transparent_60%)] opacity-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--color-brand)_0%,_transparent_60%)] opacity-10"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
          {LANDING_STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center animate-fade-in-up stagger-${i + 1}`}
            >
              <p className="bg-gradient-to-br from-white to-white/80 bg-clip-text font-display text-5xl font-extrabold tracking-tight text-transparent tabular-nums sm:text-6xl lg:text-7xl">
                <StatValue value={stat.value} />
              </p>
              <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-gradient-to-r from-brand to-amber-500" />
              <p className="mt-3 text-sm font-bold uppercase tracking-wider text-slate-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
