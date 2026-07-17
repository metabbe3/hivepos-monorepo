import { describe, it, expect } from "vitest";
import { applyMovement, canApplyMovement } from "./stock-movement";

describe("applyMovement", () => {
  describe("IN", () => {
    it("adds to current quantity", () => {
      expect(applyMovement(50, "IN", 10)).toBe(60);
    });

    it("works with zero current quantity", () => {
      expect(applyMovement(0, "IN", 5)).toBe(5);
    });

    it("works with fractional quantities", () => {
      expect(applyMovement(1.5, "IN", 0.25)).toBe(1.75);
    });
  });

  describe("OUT", () => {
    it("subtracts from current quantity when sufficient", () => {
      expect(applyMovement(50, "OUT", 10)).toBe(40);
    });

    it("returns null when insufficient stock", () => {
      expect(applyMovement(5, "OUT", 10)).toBeNull();
    });

    it("allows quantity to reach exactly zero", () => {
      expect(applyMovement(10, "OUT", 10)).toBe(0);
    });

    it("works with fractional quantities", () => {
      expect(applyMovement(2.5, "OUT", 1.5)).toBe(1);
    });
  });

  describe("ADJUSTMENT", () => {
    it("applies as delta (positive adjustment)", () => {
      expect(applyMovement(50, "ADJUSTMENT", 5)).toBe(55);
    });

    it("applies as delta (negative adjustment)", () => {
      expect(applyMovement(50, "ADJUSTMENT", -5)).toBe(45);
    });
  });

  describe("edge cases", () => {
    it("returns null for negative quantity", () => {
      expect(applyMovement(50, "IN", -5)).toBeNull();
    });

    it("handles zero quantity IN", () => {
      expect(applyMovement(50, "IN", 0)).toBe(50);
    });

    it("handles zero quantity OUT", () => {
      expect(applyMovement(50, "OUT", 0)).toBe(50);
    });
  });
});

describe("canApplyMovement", () => {
  it("returns true for valid IN", () => {
    expect(canApplyMovement(0, "IN", 10)).toBe(true);
  });

  it("returns true for valid OUT", () => {
    expect(canApplyMovement(20, "OUT", 10)).toBe(true);
  });

  it("returns false for insufficient stock OUT", () => {
    expect(canApplyMovement(5, "OUT", 10)).toBe(false);
  });

  it("returns true for OUT that reaches exactly zero", () => {
    expect(canApplyMovement(10, "OUT", 10)).toBe(true);
  });

  it("returns false for negative quantity", () => {
    expect(canApplyMovement(50, "IN", -5)).toBe(false);
  });
});
