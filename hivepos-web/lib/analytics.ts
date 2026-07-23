/**
 * GA4 analytics — env-gated. No script, no network when NEXT_PUBLIC_GA_ID is
 * unset (the site stays blind-by-default until a measurement ID is provided;
 * see docs/METRICS.md Phase 0). Set in layout.tsx via the gtag <Script> tags.
 *
 * ponytail: minimal manual gtag (no @next/third-parties dep). Upgrade to
 * @next/third-parties/google or Plausible if richer integration is needed.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Fire a GA4 event. No-op if GA_ID unset, SSR, or gtag not yet loaded. */
export function track(eventName: string, params?: Record<string, unknown>): void {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, params);
}
