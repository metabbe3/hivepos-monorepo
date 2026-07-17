import { describe, it, expect } from "vitest";
import { ConflictError } from "./app-error";
import {
  PRISM_UNIQUE_VIOLATION_CODE,
  isPrismaUniqueViolation,
  mapPrismaUniqueError,
} from "./prisma-errors";

describe("PRISM_UNIQUE_VIOLATION_CODE", () => {
  it('equals "P2002"', () => {
    expect(PRISM_UNIQUE_VIOLATION_CODE).toBe("P2002");
  });
});

describe("isPrismaUniqueViolation", () => {
  it("returns true for a P2002-shaped object", () => {
    const err = { code: "P2002", meta: { target: ["name"] } };
    expect(isPrismaUniqueViolation(err)).toBe(true);
  });

  it("returns false for an unrelated Prisma error code", () => {
    const err = { code: "P2025", meta: {} };
    expect(isPrismaUniqueViolation(err)).toBe(false);
  });

  it("returns false for a plain Error", () => {
    expect(isPrismaUniqueViolation(new Error("boom"))).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isPrismaUniqueViolation(null)).toBe(false);
    expect(isPrismaUniqueViolation(undefined)).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isPrismaUniqueViolation("P2002")).toBe(false);
  });
});

describe("mapPrismaUniqueError", () => {
  it("throws ConflictError when the error is a P2002", () => {
    const err = { code: "P2002", meta: { target: ["name"] } };
    expect(() => mapPrismaUniqueError(err, "Name already exists")).toThrow(ConflictError);
    expect(() => mapPrismaUniqueError(err, "Name already exists")).toThrow("Name already exists");
  });

  it("rethrows non-P2002 errors unchanged", () => {
    const original = new Error("some other failure");
    expect(() => mapPrismaUniqueError(original, "Should not appear")).toThrow(original);
  });

  it("rethrows plain objects that are not P2002", () => {
    const original = { code: "P2025" };
    expect(() => mapPrismaUniqueError(original, "x")).toThrow(original);
  });
});
