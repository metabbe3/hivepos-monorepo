import { describe, it, expect } from "vitest";
import { derivePaymentStatus } from "./payment-status";
import { Money } from "./money.vo";

describe("derivePaymentStatus", () => {
  it("returns PAID when paid >= total", () => {
    expect(derivePaymentStatus(100000, 100000)).toBe("PAID");
    expect(derivePaymentStatus(105000, 100000)).toBe("PAID"); // overpay
    expect(derivePaymentStatus(new Money(100), new Money(100))).toBe("PAID");
  });

  it("returns PARTIAL when 0 < paid < total", () => {
    expect(derivePaymentStatus(50000, 100000)).toBe("PARTIAL");
    expect(derivePaymentStatus(1, 100000)).toBe("PARTIAL");
  });

  it("returns PENDING when paid is 0", () => {
    expect(derivePaymentStatus(0, 100000)).toBe("PENDING");
    expect(derivePaymentStatus(Money.zero(), 100000)).toBe("PENDING");
  });

  it("handles mixed Money and number inputs", () => {
    expect(derivePaymentStatus(new Money(50000), 100000)).toBe("PARTIAL");
    expect(derivePaymentStatus(50000, new Money(100000))).toBe("PARTIAL");
  });

  it("returns PAID when total is 0 and paid is 0", () => {
    expect(derivePaymentStatus(0, 0)).toBe("PAID");
  });
});
