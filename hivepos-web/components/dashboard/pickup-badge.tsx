"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/modules/shared";

/**
 * Small numeric badge that polls `count-pending` every 45s.
 *
 * Renders null when:
 *   - the user lacks pickupRequests:read (handled by parent)
 *   - count is zero (so the sidebar stays clean when there's nothing to act on)
 */
const POLL_INTERVAL_MS = 45_000;

export function PickupBadge() {
  const [count, setCount] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;

    async function refresh() {
      try {
        const res = await apiFetch<{ count: number }>(
          "/api/pickup-requests/count-pending",
        );
        if (!cancelled) setCount(res.data.count);
      } catch {
        // Silently ignore — badge is non-critical. Likely 403/permission.
      }
    }

    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!mounted || count === 0) return null;

  return (
    <span
      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white"
      aria-label={`${count} pickup permintaan menunggu`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
