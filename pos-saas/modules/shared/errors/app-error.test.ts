import { describe, it, expect } from "vitest";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  InternalError,
  InvalidStatusTransitionError,
  NotFoundError,
  ValidationError,
} from "./app-error";
import { ErrorCode, HTTP_STATUS_BY_CODE } from "./error-code";

describe("AppError", () => {
  it("stores code, message, and resolves httpStatus from the catalog", () => {
    const err = new ValidationError("Customer is required");
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.message).toBe("Customer is required");
    expect(err.httpStatus).toBe(400);
  });

  it("preserves the cause for logging", () => {
    const root = new Error("db down");
    const err = new InternalError("something broke", { cause: root });
    expect(err.cause).toBe(root);
  });

  it("serializes to the API error envelope shape", () => {
    const err = new ValidationError("Bad input", {
      details: [{ field: "name", message: "required" }],
    });
    expect(err.toJSON()).toEqual({
      code: "VALIDATION_ERROR",
      message: "Bad input",
      details: [{ field: "name", message: "required" }],
    });
  });

  it("omits details from toJSON when none are provided", () => {
    const err = new NotFoundError("Order", "abc");
    expect(err.toJSON()).toEqual({
      code: "NOT_FOUND",
      message: "Order not found (id: abc)",
    });
    expect(err.toJSON()).not.toHaveProperty("details");
  });

  it("is recognized by instanceof across the subclass hierarchy", () => {
    const err: unknown = new ConflictError("dup");
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof ConflictError).toBe(true);
  });
});

describe("error subclasses map to the right code/status", () => {
  const cases: Array<{
    name: string;
    error: AppError;
    code: ErrorCode;
    status: number;
  }> = [
    {
      name: "ValidationError",
      error: new ValidationError("x"),
      code: ErrorCode.VALIDATION_ERROR,
      status: 400,
    },
    {
      name: "ForbiddenError",
      error: new ForbiddenError(),
      code: ErrorCode.FORBIDDEN,
      status: 403,
    },
    {
      name: "NotFoundError",
      error: new NotFoundError("Customer"),
      code: ErrorCode.NOT_FOUND,
      status: 404,
    },
    {
      name: "ConflictError",
      error: new ConflictError("dup"),
      code: ErrorCode.CONFLICT,
      status: 409,
    },
    {
      name: "InvalidStatusTransitionError",
      error: new InvalidStatusTransitionError("A", "B"),
      code: ErrorCode.INVALID_STATUS_TRANSITION,
      status: 400,
    },
    {
      name: "InternalError",
      error: new InternalError("boom"),
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
    },
  ];

  for (const { name, error, code, status } of cases) {
    it(`${name} → ${code} (${status})`, () => {
      expect(error.code).toBe(code);
      expect(error.httpStatus).toBe(status);
      expect(HTTP_STATUS_BY_CODE[code]).toBe(status);
    });
  }
});

describe("HTTP_STATUS_BY_CODE", () => {
  it("covers every error code", () => {
    const allCodes = Object.values(ErrorCode);
    for (const code of allCodes) {
      expect(HTTP_STATUS_BY_CODE[code]).toBeDefined();
      expect(typeof HTTP_STATUS_BY_CODE[code]).toBe("number");
    }
  });
});
