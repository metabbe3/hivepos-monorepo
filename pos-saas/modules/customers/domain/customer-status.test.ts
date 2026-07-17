import { describe, it, expect } from "vitest";
import { deriveCustomerStatus, daysSinceLastOrder } from "./customer-status";

const NOW = new Date("2025-06-01T00:00:00Z").getTime();

describe("deriveCustomerStatus", () => {
  it("returns NEW for a customer registered within 30 days with no orders", () => {
    const createdAt = new Date(NOW - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    expect(deriveCustomerStatus(createdAt, null, 0, NOW)).toBe("NEW");
  });

  it("returns LAPSED for a customer older than 30 days with no orders", () => {
    const createdAt = new Date(NOW - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    expect(deriveCustomerStatus(createdAt, null, 0, NOW)).toBe("LAPSED");
  });

  it("returns ACTIVE when last order is within 30 days", () => {
    const createdAt = new Date(NOW - 90 * 24 * 60 * 60 * 1000);
    const lastOrder = new Date(NOW - 5 * 24 * 60 * 60 * 1000);
    expect(deriveCustomerStatus(createdAt, lastOrder, 3, NOW)).toBe("ACTIVE");
  });

  it("returns AT_RISK when last order is between 30-90 days", () => {
    const createdAt = new Date(NOW - 120 * 24 * 60 * 60 * 1000);
    const lastOrder = new Date(NOW - 45 * 24 * 60 * 60 * 1000);
    expect(deriveCustomerStatus(createdAt, lastOrder, 2, NOW)).toBe("AT_RISK");
  });

  it("returns LAPSED when last order is over 90 days ago", () => {
    const createdAt = new Date(NOW - 200 * 24 * 60 * 60 * 1000);
    const lastOrder = new Date(NOW - 100 * 24 * 60 * 60 * 1000);
    expect(deriveCustomerStatus(createdAt, lastOrder, 1, NOW)).toBe("LAPSED");
  });

  it("returns ACTIVE at the exact 30-day boundary", () => {
    const createdAt = new Date(NOW - 365 * 24 * 60 * 60 * 1000);
    const lastOrder = new Date(NOW - 30 * 24 * 60 * 60 * 1000);
    expect(deriveCustomerStatus(createdAt, lastOrder, 1, NOW)).toBe("ACTIVE");
  });

  it("returns AT_RISK at the exact 90-day boundary", () => {
    const createdAt = new Date(NOW - 365 * 24 * 60 * 60 * 1000);
    const lastOrder = new Date(NOW - 90 * 24 * 60 * 60 * 1000);
    expect(deriveCustomerStatus(createdAt, lastOrder, 1, NOW)).toBe("AT_RISK");
  });

  it("returns NEW for a customer registered 25 days ago even with 0 orders", () => {
    const createdAt = new Date(NOW - 25 * 24 * 60 * 60 * 1000);
    expect(deriveCustomerStatus(createdAt, null, 0, NOW)).toBe("NEW");
  });

  it("does NOT return NEW if customer has orders despite being new", () => {
    const createdAt = new Date(NOW - 5 * 24 * 60 * 60 * 1000);
    const lastOrder = new Date(NOW - 1 * 24 * 60 * 60 * 1000);
    expect(deriveCustomerStatus(createdAt, lastOrder, 1, NOW)).toBe("ACTIVE");
  });
});

describe("daysSinceLastOrder", () => {
  it("returns null when no last order date", () => {
    expect(daysSinceLastOrder(null, NOW)).toBeNull();
  });

  it("returns correct days count", () => {
    const lastOrder = new Date(NOW - 10 * 24 * 60 * 60 * 1000);
    expect(daysSinceLastOrder(lastOrder, NOW)).toBe(10);
  });

  it("returns 0 for today", () => {
    expect(daysSinceLastOrder(new Date(NOW), NOW)).toBe(0);
  });
});
