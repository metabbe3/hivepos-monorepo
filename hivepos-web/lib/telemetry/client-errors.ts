"use client";

/**
 * Best-effort client-side error capture → POST /api/telemetry (persisted to
 * ErrorLog by the backend, type:"error"). Surfaced in super-admin error-logs.
 *
 * Uses bare fetch + the JWT from localStorage — NEVER apiFetch — so the error
 * reporter can't recurse or loop if the reporting call itself fails. Fire-and-
 * forget: never awaited, never throws.
 */

import { getAuthToken } from "@/lib/api/token";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

/** Report a single error. Safe to call from render / effects / event handlers. */
export function reportClientError(err: unknown, ctx?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const message =
    err instanceof Error ? `${err.name}: ${err.message}` : typeof err === "string" ? err : String(err);
  const event: Record<string, unknown> = {
    type: "error",
    message,
    url: window.location.href,
    ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
    ...(ctx ?? {}),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAuthToken();
  // ponytail: no JWT (logged-out / pre-login page) → /api/telemetry 401s and just
  // noise up ErrorLog. There's no user to attribute the error to anyway.
  if (!token) return;
  headers["Authorization"] = `Bearer ${token}`;

  // ponytail: fire-and-forget; .catch swallows so a bad receiver never throws.
  fetch(`${BASE}/telemetry`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ events: [event] }),
  }).catch(() => {});
}

/**
 * Register window-level listeners for uncaught errors + unhandled rejections.
 * Returns a teardown that removes them (wire into the React effect cleanup so
 * StrictMode double-invoke doesn't double-register).
 */
export function installGlobalErrorCapture(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (e: ErrorEvent) => reportClientError(e.error ?? new Error(e.message));
  const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
