"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Drop-in replacement for `useState` that backs the value with a **URL
 * searchParam** — so filters survive navigation (list → detail → back),
 * refresh, and are shareable/deep-linkable.
 *
 *   const [status, setStatus] = useUrlState("status", "ALL");
 *
 * - Reads from the URL on every render (so back/forward/refresh all restore it).
 * - Writes via `router.replace(..., { scroll: false })` — no scroll jump, no
 *   extra history entry per change.
 * - When the value equals `initial` (or is empty), the param is omitted → clean URLs.
 *
 * Keep data/loading/progress state on plain `useState`; use this only for values
 * the user would expect to "come back to" (filters, sort, page, date range).
 */
export function useUrlState(
  key: string,
  initial: string,
): [string, (value: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(key) ?? initial;

  const setValue = useCallback(
    (next: string) => {
      // Read live URL params at call time instead of closing over `searchParams`.
      // `useSearchParams()` returns a new instance whenever the query string
      // changes, so depending on it here makes `setValue` change identity on
      // every update — which fires any `useEffect(..., [setValue])` (e.g. the
      // orders page's reset-to-page-1 effect) on every page change and bounces
      // the user back to page 1. Dropping `searchParams` from deps stabilizes
      // `setValue` so those effects only run when their real inputs change.
      const params = new URLSearchParams(window.location.search);
      if (next === initial || next === "") params.delete(key);
      else params.set(key, next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, key, initial],
  );

  return [value, setValue];
}

/** Read a single URL param with a fallback (read-only convenience). */
export function useUrlParam(key: string, fallback = ""): string {
  const searchParams = useSearchParams();
  return searchParams.get(key) ?? fallback;
}
