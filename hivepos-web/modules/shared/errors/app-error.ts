import { ErrorCode, HTTP_STATUS_BY_CODE } from "./error-code";

/** A single field-level validation issue. */
export interface FieldError {
  /** Dotted path to the offending field, e.g. "items.0.quantity". */
  field: string;
  /** Human-readable explanation of what's wrong. */
  message: string;
}

/**
 * Base class for every error that can be surfaced to a client.
 *
 * Construct via the subclass constructors (ValidationError, NotFoundError, …)
 * rather than instantiating this directly — it keeps call sites readable and
 * ensures the code/status pairing stays consistent.
 *
 * The `cause` is ALWAYS logged by the API error handler. It is never swallowed,
 * which is the project's "no silent errors" guarantee.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details: FieldError[];
  public readonly cause: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      details?: FieldError[];
      cause?: unknown;
      httpStatus?: number;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = options.httpStatus ?? HTTP_STATUS_BY_CODE[code];
    this.details = options.details ?? [];
    this.cause = options.cause;

    // Restore prototype chain when targeted by transpilers (extends Error).
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Serialize to the API error envelope payload. */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details.length > 0 ? { details: this.details } : {}),
    };
  }
}

// ── Convenience subclasses ──────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(
    message: string,
    options: { details?: FieldError[]; cause?: unknown } = {},
  ) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

export class InvalidInputError extends AppError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(ErrorCode.INVALID_INPUT, message, options);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required") {
    super(ErrorCode.UNAUTHENTICATED, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(ErrorCode.FORBIDDEN, message);
  }
}

export class InsufficientPermissionError extends AppError {
  constructor(
    resource: string,
    action: string,
  ) {
    super(
      ErrorCode.INSUFFICIENT_PERMISSION,
      `Missing permission: ${resource}:${action}`,
    );
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      ErrorCode.NOT_FOUND,
      id ? `${resource} not found (id: ${id})` : `${resource} not found`,
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(ErrorCode.CONFLICT, message, options);
  }
}

export class BusinessRuleError extends AppError {
  constructor(
    message: string,
    options: { code?: ErrorCode; cause?: unknown } = {},
  ) {
    super(options.code ?? ErrorCode.BUSINESS_RULE_VIOLATION, message, {
      cause: options.cause,
    });
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      ErrorCode.INVALID_STATUS_TRANSITION,
      `Cannot transition status from ${from} to ${to}`,
    );
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message = "Insufficient wallet balance") {
    super(ErrorCode.INSUFFICIENT_BALANCE, message);
  }
}

export class AmountExceedsBalanceError extends AppError {
  constructor(message = "Payment amount exceeds remaining balance") {
    super(ErrorCode.AMOUNT_EXCEEDS_BALANCE, message);
  }
}

export class OutletLockedError extends AppError {
  constructor(message = "Outlet is not active. Extend the subscription to continue.") {
    super(ErrorCode.OUTLET_LOCKED, message);
  }
}

export class SubscriptionLimitReachedError extends AppError {
  constructor(message: string, details?: FieldError[]) {
    super(ErrorCode.SUBSCRIPTION_LIMIT_REACHED, message, { details });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(ErrorCode.DATABASE_ERROR, message, options);
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `${service} request failed: ${message}`,
      options,
    );
  }
}

export class InternalError extends AppError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(ErrorCode.INTERNAL_ERROR, message, options);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(ErrorCode.RATE_LIMITED, message);
  }
}
