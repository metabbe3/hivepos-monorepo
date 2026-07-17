import { describe, it, expect } from "vitest";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
  InternalError,
} from "./app-error";
import { ErrorCode } from "./error-code";
import { toAppError, isPrismaKnownError, isZodLikeError } from "./error-mapper";

describe("toAppError", () => {
  it("passes AppError instances through unchanged", () => {
    const original = new NotFoundError("Order", "123");
    const result = toAppError(original);
    expect(result).toBe(original);
  });

  it("maps Prisma P2002 (unique violation) to ConflictError", () => {
    const prismaErr = {
      code: "P2002",
      meta: { target: ["phone"], modelName: "Customer" },
      message: "Unique constraint failed",
    };
    const result = toAppError(prismaErr);
    expect(result).toBeInstanceOf(ConflictError);
    expect(result.code).toBe(ErrorCode.CONFLICT);
    expect(result.httpStatus).toBe(409);
    expect(result.message).toContain("phone");
    expect(result.cause).toBe(prismaErr);
  });

  it("maps Prisma P2025 (record not found) to NotFoundError", () => {
    const prismaErr = {
      code: "P2025",
      meta: { modelName: "Order" },
    };
    const result = toAppError(prismaErr);
    expect(result).toBeInstanceOf(NotFoundError);
    expect(result.code).toBe(ErrorCode.NOT_FOUND);
    expect(result.httpStatus).toBe(404);
  });

  it("maps Prisma P2003 (FK constraint) to ConflictError", () => {
    const prismaErr = {
      code: "P2003",
      meta: { field_name: "customerId" },
    };
    const result = toAppError(prismaErr);
    expect(result).toBeInstanceOf(ConflictError);
    expect(result.code).toBe(ErrorCode.CONFLICT);
  });

  it("maps Prisma P2024 (connection) to DatabaseError 500", () => {
    const prismaErr = { code: "P2024" };
    const result = toAppError(prismaErr);
    expect(result.code).toBe(ErrorCode.DATABASE_ERROR);
    expect(result.httpStatus).toBe(500);
  });

  it("maps Zod errors to ValidationError with all field details", () => {
    const zodErr = {
      issues: [
        { path: ["name"], message: "Name is required" },
        { path: ["items", 0, "quantity"], message: "Must be positive" },
      ],
    };
    const result = toAppError(zodErr);
    expect(result).toBeInstanceOf(ValidationError);
    expect(result.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(result.details).toEqual([
      { field: "name", message: "Name is required" },
      { field: "items.0.quantity", message: "Must be positive" },
    ]);
  });

  it("maps unknown Error to InternalError with original as cause", () => {
    const original = new Error("unexpected null");
    const result = toAppError(original);
    expect(result).toBeInstanceOf(InternalError);
    expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(result.httpStatus).toBe(500);
    expect(result.cause).toBe(original);
  });

  it("maps non-Error throws to InternalError", () => {
    const result = toAppError("something weird");
    expect(result).toBeInstanceOf(InternalError);
    expect(result.message).toBe("something weird");
  });

  it("maps null to InternalError", () => {
    const result = toAppError(null);
    expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("maps TypeError with 'fetch' to InternalError (network)", () => {
    const result = toAppError(new TypeError("fetch failed"));
    expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(result.cause).toBeInstanceOf(TypeError);
  });
});

describe("type guards", () => {
  it("isPrismaKnownError detects P-codes", () => {
    expect(isPrismaKnownError({ code: "P2002" })).toBe(true);
    expect(isPrismaKnownError({ code: "P2025" })).toBe(true);
    expect(isPrismaKnownError({ code: "ECONNRESET" })).toBe(false);
    expect(isPrismaKnownError(new Error("nope"))).toBe(false);
    expect(isPrismaKnownError(null)).toBe(false);
  });

  it("isZodLikeError detects issues arrays", () => {
    expect(isZodLikeError({ issues: [] })).toBe(true);
    expect(isZodLikeError({ issues: [{ path: [], message: "x" }] })).toBe(true);
    expect(isZodLikeError(new Error("nope"))).toBe(false);
    expect(isZodLikeError({ issues: "not-array" })).toBe(false);
  });
});
