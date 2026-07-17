"use client";

import { useEffect } from "react";
import { startFlushLoop } from "@/lib/client-telemetry";
import { useWebVitalsReporter } from "@/hooks/use-web-vitals-reporter";

/**
 * Mounts the telemetry flush loop + web vitals reporter. No UI. Sits at the
 * dashboard layout root so flush triggers (interval, visibilitychange, pagehide)
 * stay alive across route changes. Production-only — both noop in dev.
 */
export function TelemetryFlusher() {
  useEffect(() => startFlushLoop(), []);
  useWebVitalsReporter();
  return null;
}
