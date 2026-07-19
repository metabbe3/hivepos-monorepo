import {
  type ErrorEnvelope,
  type ResponseMeta,
  type SuccessEnvelope,
  isErrorEnvelope,
} from "./response";
import { withRetry, isTransientError } from "@/lib/api/retry";

/** Thrown when a fetch request returns a non-success envelope or fails the network call. */
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** JSON-serializable request body. */
  body?: unknown;
}

/**
 * Typed client-side fetch wrapper that understands the standardized API envelope.
 *
 *   const { data } = await apiFetch<OrderListDTO>("/api/orders");
 *   const order = await apiFetch<OrderDTO>("/api/orders", { method: "POST", body: input });
 *
 * On error, throws ApiClientError with the server's code/message so callers
 * can surface a user-friendly toast.
 */
// hivepos-web: route ported "/api/..." calls to the Go backend (origin only — url already
// carries /api). NEXT_PUBLIC_API_BASE_URL may be "/api" (Caddy same-origin) or
// "http://host:8080/api" (direct); strip the trailing /api so we prepend just the origin.
// Server (SSR) needs an ABSOLUTE origin (relative fetch has no base on the server) — use
// API_BASE_URL_SSR there when set (e.g. http://api:8080/api in compose).
const RAW_BASE =
  typeof window === "undefined"
    ? (process.env.API_BASE_URL_SSR ?? process.env.NEXT_PUBLIC_API_BASE_URL)
    : process.env.NEXT_PUBLIC_API_BASE_URL;
const ORIGIN = (RAW_BASE ?? "/api").replace(/\/api\/?$/, "");

export async function apiFetch<T>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<{ data: T; meta?: ResponseMeta }> {
  const { body, headers, ...rest } = options;

  // Attach JWT (Go returns it in the login body; stored by lib/auth-client via lib/api/token).
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("hivepos_token") : null;

  // One attempt = fetch + envelope parse. withRetry re-runs it ONLY on transient
  // failures (429/5xx/network); 4xx throws immediately. See @/lib/api/retry.
  return withRetry(
    async (signal) => {
      const res = await fetch(`${ORIGIN}${url}`, {
        ...rest,
        credentials: "include",
        signal: signal ?? rest.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const json: unknown = await res.json().catch(() => null);

      if (isErrorEnvelope(json)) {
    const env = json as ErrorEnvelope;
    throw new ApiClientError(
      env.error.code,
      env.error.message,
      res.status,
      env.error.details,
    );
  }

  if (!res.ok || !json || typeof json !== "object") {
    throw new ApiClientError(
      "UNKNOWN",
      `Request failed with status ${res.status}`,
      res.status,
    );
  }

  const env = json as SuccessEnvelope<T>;
      return { data: env.data, meta: env.meta };
    },
    isTransientError,
    { attempts: 3, timeoutMs: 0 },
  );
}

/**
 * Raw fetch to the Go backend (origin + Bearer) for non-JSON responses — file uploads
 * (FormData), blob downloads (xlsx export), streaming. Returns the raw Response; caller
 * handles parsing. Use `apiFetch` for normal JSON envelope calls.
 */
export async function apiRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("hivepos_token") : null;
  return fetch(`${ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}
