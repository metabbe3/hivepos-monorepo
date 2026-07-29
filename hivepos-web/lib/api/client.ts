/**
 * Typed API client for hivepos-api (Go) — and the legacy pos-saas backend
 * during the migration transition (both speak the same envelope + DTO shapes).
 *
 * - Base URL: NEXT_PUBLIC_API_BASE_URL (default "/api" → same-origin via Caddy).
 * - Auth: cookie-based JWT, sent automatically via credentials:"include".
 *   (Backend sets the httpOnly cookie on /auth/login; same-origin = no CORS.)
 * - Understands the { success, data, meta?, error? } envelope; throws on error.
 *
 * Domain types are imported from ./types (generated from contracts/openapi.yaml).
 */

import { withRetry, isTransientError } from "./retry";

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: { field: string; message: string }[],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

const BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

/** Envelope-aware fetch. Returns { data, meta? } or throws ApiClientError. */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<{ data: T; meta?: ResponseMeta }> {
  const { body, headers, ...rest } = options;

  // Auth is the httpOnly hp_session cookie (set by the backend on /auth/login +
  // /auth/login-bounce), sent automatically via credentials:"include". The JWT no
  // longer lives in localStorage (XSS-exfiltrable) — JS can't read the cookie.
  // ponytail: the port left two path conventions in the call sites — 58 pass "/api/...",
  // auth-client passes "/auth/...". BASE already ends with "/api", so strip a duplicate
  // "/api" prefix so both resolve to "<base>/...". Tighten to one convention once port settles.
  const normPath = BASE.endsWith("/api") && path.startsWith("/api/") ? path.slice(4) : path;

  // One attempt = fetch + envelope parse. withRetry re-runs it ONLY on transient
  // failures (429/5xx/network); 4xx throws immediately, untouched. See ./retry.ts.
  return withRetry(
    async (signal) => {
      const res = await fetch(`${BASE}${normPath}`, {
        ...rest,
        credentials: "include",
        signal: signal ?? rest.signal,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const json: unknown = await res.json().catch(() => null);

      // NOTE: do NOT clear the token here on 401. That triggers a useSession
      // re-render → the page's useEffect fires again → 401 again → infinite loop.
      // reloadSession (in auth-client) is the single source of truth for clearing
      // the token + setting status="unauthenticated". SessionGuard handles the redirect.

      const requestId = res.headers.get("X-Request-Id") ?? undefined;

      if (json && typeof json === "object" && (json as { success?: unknown }).success === false) {
        const err = (json as { error?: { code?: string; message: string; details?: { field: string; message: string }[] } }).error;
        throw new ApiClientError(err?.code ?? "UNKNOWN", err?.message ?? "Request failed", res.status, err?.details, requestId);
      }

      if (!res.ok || !json || typeof json !== "object") {
        throw new ApiClientError("UNKNOWN", `Request failed with status ${res.status}`, res.status, undefined, requestId);
      }

      const env = json as { data: T; meta?: ResponseMeta };
      return { data: env.data, meta: env.meta };
    },
    isTransientError,
    { attempts: 3, timeoutMs: 0 },
  );
}
