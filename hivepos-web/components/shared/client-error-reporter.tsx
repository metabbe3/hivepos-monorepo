"use client";

import { useEffect } from "react";
import { installGlobalErrorCapture } from "@/lib/telemetry/client-errors";

/**
 * Mount once in the root layout to capture uncaught window errors + unhandled
 * promise rejections → ErrorLog via /api/telemetry. Progressive enhancement;
 * renders nothing.
 */
export function ClientErrorReporter() {
  useEffect(() => installGlobalErrorCapture(), []);
  return null;
}
