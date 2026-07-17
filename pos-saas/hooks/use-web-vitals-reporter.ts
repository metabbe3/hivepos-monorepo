"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { queueTelemetry } from "@/lib/client-telemetry";

// ponytail: hand-rolled Web Vitals. The `web-vitals` npm package is 1.5KB but
// adds an abstraction we don't need for 4 metrics. These approximations are
// good enough for an early-warning dashboard:
//   - FCP/LCP: exact (PerformanceObserver standard)
//   - CLS: max single layout-shift value, not session-windowed — undercounts
//     multi-shift sessions but flags problem routes
//   - INP: max event duration with interactionId — close to the spec p98
//
// Reports on `visibilitychange` (hidden) + `pagehide`, matching the web-vitals
// library pattern. Production-only — `queueTelemetry` noop's in dev.

function isProd(): boolean {
  return typeof window !== "undefined" && process.env.NODE_ENV === "production";
}

export function useWebVitalsReporter(): void {
  const pathname = usePathname();
  const routeRef = useRef(pathname);
  routeRef.current = pathname;

  useEffect(() => {
    if (!isProd()) return;

    let lcp = 0;
    let fcp = 0;
    let maxShift = 0;
    let maxInp = 0;
    let reported = false;

    const report = () => {
      if (reported) return;
      reported = true;
      queueTelemetry("web_vitals", {
        route: routeRef.current,
        lcp: Math.round(lcp),
        cls: Number(maxShift.toFixed(3)),
        inp: Math.round(maxInp),
        fcp: Math.round(fcp),
      });
    };

    // FCP — read once from buffered entries (already complete by hydration).
    const fcpEntries = performance.getEntriesByName("first-contentful-paint");
    if (fcpEntries.length > 0) fcp = fcpEntries[0].startTime;

    let lcpObs: PerformanceObserver | null = null;
    let clsObs: PerformanceObserver | null = null;
    let inpObs: PerformanceObserver | null = null;

    try {
      lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) lcp = entries[entries.length - 1].startTime;
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });

      clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // ponytail: max single shift, not session-windowed.
          maxShift = Math.max(maxShift, (entry as PerformanceEntry & { value: number }).value);
        }
      });
      clsObs.observe({ type: "layout-shift", buffered: true });

      inpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const anyEntry = entry as PerformanceEntry & { interactionId?: number };
          if (anyEntry.interactionId) {
            maxInp = Math.max(maxInp, entry.duration);
          }
        }
      });
      inpObs.observe({ type: "event", buffered: true });
    } catch {
      // PerformanceObserver type unsupported (old Safari) — skip silently.
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") report();
    };
    const onPageHide = () => report();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      lcpObs?.disconnect();
      clsObs?.disconnect();
      inpObs?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [pathname]);
}
