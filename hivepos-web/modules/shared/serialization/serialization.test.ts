import { describe, it, expect } from "vitest";
import {
  toIso,
  toIsoRequired,
  decimalToNumber,
  decimalToNumberRequired,
} from "./index";

describe("toIso", () => {
  it("returns null for null", () => {
    expect(toIso(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(toIso(undefined)).toBeNull();
  });

  it("returns ISO string for a Date", () => {
    const date = new Date("2024-01-15T10:30:00.000Z");
    expect(toIso(date)).toBe("2024-01-15T10:30:00.000Z");
  });

  it("preserves millisecond precision", () => {
    const date = new Date("2024-01-15T10:30:00.123Z");
    expect(toIso(date)).toBe("2024-01-15T10:30:00.123Z");
  });
});

describe("toIsoRequired", () => {
  it("returns ISO string for a Date", () => {
    const date = new Date("2024-01-15T10:30:00.000Z");
    expect(toIsoRequired(date)).toBe("2024-01-15T10:30:00.000Z");
  });

  it("preserves millisecond precision", () => {
    const date = new Date("2024-06-01T00:00:00.999Z");
    expect(toIsoRequired(date)).toBe("2024-06-01T00:00:00.999Z");
  });
});

describe("decimalToNumber", () => {
  it("returns null for null", () => {
    expect(decimalToNumber(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(decimalToNumber(undefined)).toBeNull();
  });

  it("returns the same number when given a number", () => {
    expect(decimalToNumber(42)).toBe(42);
  });

  it("returns 0 for literal 0 (not falsy-filtered)", () => {
    expect(decimalToNumber(0)).toBe(0);
  });

  it("converts a Decimal-like object via toNumber()", () => {
    const decimalLike = { toNumber: () => 199999.99 };
    expect(decimalToNumber(decimalLike)).toBe(199999.99);
  });

  it("preserves 2-decimal money precision", () => {
    const decimalLike = { toNumber: () => 1234567.89 };
    expect(decimalToNumber(decimalLike)).toBe(1234567.89);
  });

  it("preserves high money precision (the regression-catcher)", () => {
    // Anything above Number.MAX_SAFE_INTEGER would already be a Prisma schema bug,
    // but we still want to confirm that typical max ledger values round-trip cleanly.
    const decimalLike = { toNumber: () => 999999999.99 };
    expect(decimalToNumber(decimalLike)).toBe(999999999.99);
  });

  it("returns 0 when Decimal-like resolves to 0 (not falsy-filtered)", () => {
    const decimalLike = { toNumber: () => 0 };
    expect(decimalToNumber(decimalLike)).toBe(0);
  });
});

describe("decimalToNumberRequired", () => {
  it("returns the same number when given a number", () => {
    expect(decimalToNumberRequired(42)).toBe(42);
  });

  it("converts a Decimal-like object via toNumber()", () => {
    const decimalLike = { toNumber: () => 99.5 };
    expect(decimalToNumberRequired(decimalLike)).toBe(99.5);
  });

  it("preserves 2-decimal money precision", () => {
    const decimalLike = { toNumber: () => 19999.99 };
    expect(decimalToNumberRequired(decimalLike)).toBe(19999.99);
  });
});
