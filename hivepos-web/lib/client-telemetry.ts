// Client-side telemetry reporter. Singleton queue + flush triggers.
//
// Flush happens when ANY of:
//   - queue reaches FLUSH_AT events
//   - FLUSH_INTERVAL_MS passes since last flush
//   - tab becomes hidden (visibilitychange)
//   - page is unloaded (pagehide — uses sendBeacon for reliability)
//
// ponytail: module-level singleton instead of React context. Multiple
// components call queueTelemetry() without prop drilling. The React
// <TelemetryFlusher /> component (mounted in dashboard layout) just owns
// the lifecycle — sets up interval + listeners, flushes on unmount.
//
// Disabled in dev — Turbopack HMR + telemetry = noise. See
// components/shared/telemetry-flusher.tsx for the gate.

import type { TelemetryKind } from "@/lib/telemetry";

interface QueuedEvent {
  kind: TelemetryKind;
  payload: Record<string, unknown>;
  ts: number;
}

const FLUSH_AT = 20;
const FLUSH_INTERVAL_MS = 10_000;
const ENDPOINT = "/api/telemetry";

const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function isProd(): boolean {
  return typeof window !== "undefined" && process.env.NODE_ENV === "production";
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    // Best-effort. Failures drop the batch — telemetry is fire-and-forget,
    // retrying risks amplifying a bad endpoint.
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Network error — drop. Don't requeue; the next event will try again.
  }
}

function flushBeacon(): void {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    navigator.sendBeacon(
      ENDPOINT,
      new Blob([JSON.stringify({ events: batch })], { type: "application/json" }),
    );
  } catch {
    // sendBeacon not supported — nothing we can do on unload.
  }
}

export function queueTelemetry(
  kind: TelemetryKind,
  payload: Record<string, unknown>,
): void {
  if (!isProd()) return;
  queue.push({ kind, payload, ts: Date.now() });
  if (queue.length >= FLUSH_AT) {
    void flush();
  }
}

// Internal — called only by <TelemetryFlusher>. Exported for the component.
export function startFlushLoop(): () => void {
  if (!isProd()) return () => {};

  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);

  const onVisibility = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  const onPageHide = () => flushBeacon();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  return () => {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    // Final flush on unmount (route change within SPA).
    void flush();
  };
}
