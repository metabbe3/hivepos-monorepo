import { NextResponse } from "next/server";
import type { ZodTypeAny, infer as zinfer } from "zod/v4";
import { ValidationError } from "../errors/app-error";
import { mapZodError, toAppError } from "../errors/error-mapper";
import { logger } from "../logging/logger";
import { apiError, apiCreated, apiSuccess, type ResponseMeta, type SuccessEnvelope } from "./response";

/** Context object passed to route handlers (the second Next.js arg). */
export type RouteContext<P extends Record<string, string>> = {
  params: Promise<P>;
};

/**
 * Wrap an async route handler so every error is caught, logged, and returned
 * as a standardized error envelope.
 *
 * - AppError → mapped to its declared HTTP status + code
 * - Prisma / Zod errors → mapped to the closest domain code
 * - Anything else → INTERNAL_ERROR (500), full detail logged, sanitized message
 *
 * This is the single place that guarantees "no silent errors": every rejected
 * promise is logged at `error` level before the response is sent.
 */
export function withErrorHandler<T = unknown>(
  handler: (
    req: Request,
    ctx?: RouteContext<Record<string, string>>,
  ) => Promise<NextResponse<SuccessEnvelope<T>>>,
): (
  req: Request,
  ctx?: RouteContext<Record<string, string>>,
) => Promise<NextResponse> {
  return async (req, ctx) => {
    const requestId = crypto.randomUUID();

    try {
      return await handler(req, ctx);
    } catch (error) {
      const appError = toAppError(error);

      // Client errors (4xx) are expected flow → warn level.
      // System errors (5xx) signal something worth alerting on.
      const isClientError = appError.httpStatus < 500;

      logger[isClientError ? "warn" : "error"](
        {
          requestId,
          code: appError.code,
          httpStatus: appError.httpStatus,
          method: req.method,
          url: req.url,
          stack: error instanceof Error ? error.stack : undefined,
          cause:
            appError.cause instanceof Error
              ? appError.cause.message
              : appError.cause,
        },
        appError.message,
      );

      // Persist 5xx only. Fire-and-forget — must never break the response.
      // 4xx are user mistakes; they stay in Pino logs only.
      //
      // ponytail: the writer is registered at server boot via
      // instrumentation.ts → registerErrorLogWriter(). Looking it up here via
      // a runtime function avoids a static import of lib/prisma (which would
      // drag node:pg into the client bundle through @/modules/shared).
      if (!isClientError && typeof window === "undefined") {
        try {
          // Inline lazy require — keeps this off the static module graph of
          // client consumers. Caught + swallowed, never rethrown.
          const { getErrorLogWriter } = require("@/lib/error-log-writer") as {
            getErrorLogWriter: () => ((input: unknown) => void) | null;
          };
          const writer = getErrorLogWriter();
          if (writer) {
            writer({
              requestId,
              method: req.method,
              url: req.url,
              httpStatus: appError.httpStatus,
              code: appError.code,
              message: appError.message,
              stack: error instanceof Error ? error.stack : null,
              tenantId: extractTenantIdFromUrl(req.url),
              userId: null,
              ipAddress:
                req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
                req.headers.get("x-real-ip") ??
                null,
              userAgent: req.headers.get("user-agent"),
            });
          }
        } catch {
          // ponytail: if require fails (build/runtime mismatch) — swallow.
        }
      }

      return apiError(appError);
    }
  };
}

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Throws ValidationError (caught by withErrorHandler) on failure.
 */
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<zinfer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw mapZodError(result.error);
  }

  return result.data;
}

/**
 * Parse and validate a route's query parameters against a Zod schema.
 * Throws ValidationError on failure.
 */
export async function parseQuery<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<zinfer<S>> {
  const { searchParams } = new URL(req.url);
  const obj: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    obj[key] = value;
  }

  const result = schema.safeParse(obj);
  if (!result.success) {
    throw mapZodError(result.error);
  }

  return result.data;
}

export { apiSuccess, apiCreated, type ResponseMeta, type SuccessEnvelope };

/**
 * Best-effort tenantId extraction from a /api/.../tenants/<uuid>/... URL.
 * Used by the ErrorLog persistence path so we can attribute 5xx errors to a
 * tenant without a full session lookup (which would re-introduce the failure
 * surface we're trying to avoid). Returns null when not attributable.
 */
function extractTenantIdFromUrl(rawUrl: string): string | null {
  const m = rawUrl.match(/\/api\/(?:super-admin\/)?tenants\/([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}
