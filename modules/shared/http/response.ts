import { NextResponse } from "next/server";
import type { AppError, FieldError } from "../errors/app-error";

/** Metadata for paginated or count-based responses. */
export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

/** Standard success envelope returned by every API route. */
export interface SuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

/** Standard error envelope returned by every API route. */
export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: FieldError[];
  };
}

/** Convenience type guard for the error envelope on the client. */
export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { success?: unknown }).success === false &&
    typeof (value as { error?: unknown }).error === "object"
  );
}

/** Convenience type guard for the success envelope on the client. */
export function isSuccessEnvelope<T = unknown>(
  value: unknown,
): value is SuccessEnvelope<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { success?: unknown }).success === true
  );
}

/**
 * Build a success response (HTTP 200 by default).
 *
 *   return apiSuccess(orders, { page, total, totalPages });
 */
export function apiSuccess<T>(
  data: T,
  meta?: ResponseMeta,
  status = 200,
): NextResponse<SuccessEnvelope<T>> {
  const body: SuccessEnvelope<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return NextResponse.json(body, { status });
}

/** Build a 201 Created success response. */
export function apiCreated<T>(data: T): NextResponse<SuccessEnvelope<T>> {
  return apiSuccess(data, undefined, 201);
}

/**
 * Build an error response from an AppError.
 *
 * Used internally by `withErrorHandler`; rarely called directly from routes.
 */
export function apiError(error: AppError): NextResponse<ErrorEnvelope> {
  return NextResponse.json(
    { success: false, error: error.toJSON() },
    { status: error.httpStatus },
  );
}
