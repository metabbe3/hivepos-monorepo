import {
  AppError,
  ConflictError,
  DatabaseError,
  InternalError,
  NotFoundError,
  ValidationError,
  type FieldError,
} from "./app-error";
import { ErrorCode } from "./error-code";

// ── Structural type guards (no Prisma/Zod import coupling) ──────────────

/** Prisma `PrismaClientKnownRequestError` — identified by its `Pxxxx` code. */
interface PrismaKnownError {
  code: string;
  meta?: Record<string, unknown>;
  message?: string;
}

function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    /^P\d{4}$/.test((err as { code: string }).code)
  );
}

/** Zod (v3 or v4) error — identified by its `issues` array. */
interface ZodLikeError {
  issues: Array<{ path: Array<string | number | symbol>; message: string }>;
}

function isZodLikeError(err: unknown): err is ZodLikeError {
  return (
    typeof err === "object" &&
    err !== null &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown }).issues)
  );
}

/** Join a Zod path array into a dotted field identifier. */
function formatFieldPath(path: Array<string | number | symbol>): string {
  return path.map(String).join(".") || "(root)";
}

// ── Prisma code → AppError mapping ──────────────────────────────────────

/**
 * Convert a Prisma known request error to an AppError.
 *
 * Reference: https://www.prisma.io/docs/orm/reference/error-reference
 */
function mapPrismaError(err: PrismaKnownError): AppError {
  const meta = err.meta ?? {};
  const target = Array.isArray(meta.target)
    ? (meta.target as string[]).join(", ")
    : "record";
  const model = typeof meta.modelName === "string" ? meta.modelName : "Record";

  switch (err.code) {
    case "P2002":
      // Unique constraint violation
      return new ConflictError(
        `${model} with ${target} already exists`,
        { cause: err },
      );

    case "P2025":
      // Record not found (findUniqueOrThrow / update / delete on missing row)
      return new NotFoundError(model);

    case "P2003":
      // Foreign key constraint failure
      return new ConflictError(
        `Cannot complete operation: ${target} is referenced by other records`,
        { cause: err },
      );

    case "P2014":
      // Invalid required relation
      return new ValidationError(
        `Invalid relation: ${target}`,
        { cause: err },
      );

    case "P2024":
      // Connection timeout / pool exhausted
      return new DatabaseError("Database connection timed out", { cause: err });

    default:
      return new DatabaseError(
        `Database error (${err.code})`,
        { cause: err },
      );
  }
}

// ── Zod → AppError mapping ──────────────────────────────────────────────

/** Convert a Zod validation error to a ValidationError with full field details. */
export function mapZodError(err: ZodLikeError): ValidationError {
  const details: FieldError[] = err.issues.map((issue) => ({
    field: formatFieldPath(issue.path),
    message: issue.message,
  }));

  const primaryMessage = details[0]?.message ?? "Validation failed";

  return new ValidationError(primaryMessage, { details });
}

// ── Unified mapper ──────────────────────────────────────────────────────

/**
 * Convert any thrown value into an AppError.
 *
 * - AppError instances pass through unchanged.
 * - Prisma / Zod errors are mapped to domain-appropriate codes.
 * - Everything else becomes INTERNAL_ERROR (always logged, never silent).
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (isPrismaKnownError(error)) return mapPrismaError(error);

  if (isZodLikeError(error)) return mapZodError(error);

  // Network / fetch failures from external services
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new InternalError("Network request failed", { cause: error });
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred";

  return new InternalError(message, { cause: error });
}

export { isPrismaKnownError, isZodLikeError };
