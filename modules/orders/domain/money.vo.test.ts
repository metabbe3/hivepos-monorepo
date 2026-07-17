import { describe, it, expect } from "vitest";
import { Money } from "./money.vo";

describe("Money", () => {
  it("creates from a number", () => {
    expect(new Money(100).amount).toBe(100);
  });

  it("creates zero", () => {
    expect(Money.zero().amount).toBe(0);
  });

  it("converts from Money or number via from()", () => {
    expect(Money.from(50).amount).toBe(50);
    expect(Money.from(Money.zero()).amount).toBe(0);
  });

  it("rounds to 2 decimal places to avoid float drift", () => {
    expect(new Money(10.005).amount).toBe(10.01);
    expect(new Money(10.004).amount).toBe(10);
    expect(new Money(0.1 + 0.2).amount).toBe(0.3);
  });

  it("rejects non-finite values", () => {
    expect(() => new Money(NaN)).toThrow();
    expect(() => new Money(Infinity)).toThrow();
    expect(() => new Money("100" as unknown as number)).toThrow();
  });

  describe("arithmetic", () => {
    it("add", () => {
      expect(new Money(100).add(50).amount).toBe(150);
      expect(new Money(100).add(Money.zero()).amount).toBe(100);
    });

    it("subtract", () => {
      expect(new Money(100).subtract(30).amount).toBe(70);
    });

    it("multiply", () => {
      expect(new Money(100).multiply(3).amount).toBe(300);
      expect(new Money(7000).multiply(1.5).amount).toBe(10500);
    });

    it("percent", () => {
      expect(new Money(100000).percent(10).amount).toBe(10000);
      expect(new Money(50000).percent(0).amount).toBe(0);
    });

    it("min caps at the given value", () => {
      expect(new Money(50000).min(30000).amount).toBe(30000);
      expect(new Money(10000).min(30000).amount).toBe(10000);
    });
  });

  describe("comparisons", () => {
    it("isNegative / isZero", () => {
      expect(Money.zero().isZero()).toBe(true);
      expect(new Money(-1).isNegative()).toBe(true);
      expect(new Money(0).isNegative()).toBe(false);
    });

    it("isGreaterThan / isLessThan / equals", () => {
      expect(new Money(100).isGreaterThan(50)).toBe(true);
      expect(new Money(100).isLessThan(200)).toBe(true);
      expect(new Money(100).equals(100)).toBe(true);
      expect(new Money(100).isGreaterThanOrEqual(100)).toBe(true);
    });
  });

  it("toString formats to 2 decimals", () => {
    expect(new Money(100).toString()).toBe("100.00");
    expect(new Money(99.5).toString()).toBe("99.50");
  });
});
