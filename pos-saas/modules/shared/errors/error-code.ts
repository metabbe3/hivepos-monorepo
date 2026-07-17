/**
 * Centralized error code catalog.
 *
 * Every error surfaced through the API carries one of these codes so clients
 * can branch on a stable identifier instead of parsing free-text messages.
 *
 * Grouped by category:
 *  - Validation (4xx): input failed schema or business-format checks
 *  - Auth (401/403): identity or permission failures
 *  - Resource (404/409/412): the target entity couldn't be found or is in conflict
 *  - Business rule (400/403): an allowed-but-invalid operation for the current state
 *  - Infrastructure (500/502): unexpected system or external-service failures
 */

export const ErrorCode = {
  // ── Validation (400) ──
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // ── Auth (401 / 403) ──
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSION: "INSUFFICIENT_PERMISSION",

  // ── Resource (404 / 409 / 412) ──
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PRECONDITION_FAILED: "PRECONDITION_FAILED",

  // ── Business rules (400 / 403) ──
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  AMOUNT_EXCEEDS_BALANCE: "AMOUNT_EXCEEDS_BALANCE",
  OUTLET_LOCKED: "OUTLET_LOCKED",
  SUBSCRIPTION_LIMIT_REACHED: "SUBSCRIPTION_LIMIT_REACHED",

  // ── Traffic shaping (429) ──
  RATE_LIMITED: "RATE_LIMITED",

  // ── Infrastructure (500 / 502) ──
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Maps each error code to its canonical HTTP status. */
export const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,

  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INSUFFICIENT_PERMISSION: 403,

  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,

  BUSINESS_RULE_VIOLATION: 400,
  INVALID_STATUS_TRANSITION: 400,
  INSUFFICIENT_BALANCE: 400,
  AMOUNT_EXCEEDS_BALANCE: 400,
  OUTLET_LOCKED: 403,
  SUBSCRIPTION_LIMIT_REACHED: 403,

  RATE_LIMITED: 429,

  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  EXTERNAL_SERVICE_ERROR: 502,
};

/** All valid error codes (for runtime validation / iteration). */
export const ALL_ERROR_CODES = Object.values(ErrorCode);
