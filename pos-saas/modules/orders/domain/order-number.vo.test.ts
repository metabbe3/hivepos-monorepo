import { describe, it, expect } from "vitest";
import {
  orderNumberPrefix,
  generateOrderNumber,
  parseSequence,
} from "./order-number.vo";

describe("orderNumberPrefix", () => {
  it("builds CODE-YYYYMMDD- from a UTC date + tenant code", () => {
    expect(orderNumberPrefix(new Date("2025-01-15T00:00:00Z"), "HBL")).toBe("HBL-20250115-");
    expect(orderNumberPrefix(new Date("2025-12-31T23:59:59Z"), "TT")).toBe("TT-20251231-");
  });
});

describe("generateOrderNumber", () => {
  it("generates the first number of the day (sequence 0 → 0001)", () => {
    const date = new Date("2025-06-15T00:00:00Z");
    expect(generateOrderNumber(date, 0, "HBL")).toBe("HBL-20250615-0001");
  });

  it("increments the sequence from the last existing number", () => {
    const date = new Date("2025-06-15T00:00:00Z");
    expect(generateOrderNumber(date, 3, "HBL")).toBe("HBL-20250615-0004");
    expect(generateOrderNumber(date, 99, "HBL")).toBe("HBL-20250615-0100");
    expect(generateOrderNumber(date, 999, "HBL")).toBe("HBL-20250615-1000");
  });

  it("zero-pads to 4 digits", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    expect(generateOrderNumber(date, 0, "TT")).toMatch(/-0001$/);
    expect(generateOrderNumber(date, 9, "TT")).toMatch(/-0010$/);
  });
});

describe("parseSequence", () => {
  it("extracts the sequence from a valid order number", () => {
    expect(parseSequence("HBL-20250615-0001")).toBe(1);
    expect(parseSequence("HBL-20250615-0042")).toBe(42);
    expect(parseSequence("HBL-20250615-9999")).toBe(9999);
  });

  it("returns 0 for malformed strings", () => {
    expect(parseSequence("garbage")).toBe(0);
    expect(parseSequence("HBL-20250615")).toBe(0);
    expect(parseSequence("")).toBe(0);
  });
});
