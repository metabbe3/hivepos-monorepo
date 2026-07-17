import {
  type ErrorEnvelope,
  type ResponseMeta,
  type SuccessEnvelope,
  isErrorEnvelope,
} from "./response";

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
export async function apiFetch<T>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<{ data: T; meta?: ResponseMeta }> {
  const { body, headers, ...rest } = options;

  const res = await fetch(url, {
    ...rest,
    headers: {
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
}
