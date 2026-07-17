import { describe, it, expect } from "vitest";
import {
  calculateItemSubtotal,
  calculateDiscount,
  priceOrder,
  sumMoney,
} from "./pricing";
import { Money } from "./money.vo";
import type { OrderItemInput, ServicePricing } from "./types";

const kgService: ServicePricing = {
  id: "svc-kg",
  basePrice: 7000,
  pricingType: "PER_KG",
  module: "LAUNDRY",
};

const itemService: ServicePricing = {
  id: "svc-item",
  basePrice: 15000,
  pricingType: "PER_ITEM",
  module: "LAUNDRY",
};

const flatService: ServicePricing = {
  id: "svc-flat",
  basePrice: 50000,
  pricingType: "FLAT",
  module: "LAUNDRY",
};

describe("calculateItemSubtotal", () => {
  it("PER_KG: multiplies basePrice by weightKg", () => {
    const item: OrderItemInput = { serviceId: "svc-kg", quantity: 1, weightKg: 2.5 };
    expect(calculateItemSubtotal(kgService, item).amount).toBe(17500);
  });

  it("PER_KG: defaults weightKg to 0 when missing", () => {
    const item: OrderItemInput = { serviceId: "svc-kg", quantity: 1 };
    expect(calculateItemSubtotal(kgService, item).amount).toBe(0);
  });

  it("PER_ITEM: multiplies basePrice by quantity", () => {
    const item: OrderItemInput = { serviceId: "svc-item", quantity: 3 };
    expect(calculateItemSubtotal(itemService, item).amount).toBe(45000);
  });

  it("FLAT: returns the base price regardless of quantity", () => {
    const item: OrderItemInput = { serviceId: "svc-flat", quantity: 5 };
    expect(calculateItemSubtotal(flatService, item).amount).toBe(50000);
  });
});

describe("calculateDiscount", () => {
  it("PERCENTAGE: computes percentage of subtotal", () => {
    expect(calculateDiscount(new Money(100000), "PERCENTAGE", 10).amount).toBe(10000);
    expect(calculateDiscount(new Money(50000), "PERCENTAGE", 15).amount).toBe(7500);
  });

  it("FIXED: returns the amount when below subtotal", () => {
    expect(calculateDiscount(new Money(100000), "FIXED", 20000).amount).toBe(20000);
  });

  it("FIXED: is capped at subtotal so total never goes negative", () => {
    expect(calculateDiscount(new Money(30000), "FIXED", 50000).amount).toBe(30000);
  });

  it("returns zero for null/undefined/zero amount", () => {
    expect(calculateDiscount(new Money(100000), null, 10).amount).toBe(0);
    expect(calculateDiscount(new Money(100000), "PERCENTAGE", 0).amount).toBe(0);
    expect(calculateDiscount(new Money(100000), "PERCENTAGE", undefined).amount).toBe(0);
  });

  it("returns zero for negative amounts", () => {
    expect(calculateDiscount(new Money(100000), "FIXED", -5).amount).toBe(0);
  });
});

describe("sumMoney", () => {
  it("sums multiple amounts", () => {
    expect(sumMoney([new Money(100), new Money(200), new Money(300)]).amount).toBe(600);
  });

  it("returns zero for empty array", () => {
    expect(sumMoney([]).amount).toBe(0);
  });
});

describe("priceOrder", () => {
  const services = new Map<string, ServicePricing>([
    ["svc-kg", kgService],
    ["svc-item", itemService],
  ]);

  it("computes subtotals, discount, and total for a multi-item order", () => {
    const items: OrderItemInput[] = [
      { serviceId: "svc-kg", quantity: 1, weightKg: 3 }, // 21000
      { serviceId: "svc-item", quantity: 2 }, // 30000
    ];

    const result = priceOrder(items, services, "PERCENTAGE", 10);

    expect(result.subtotal.amount).toBe(51000);
    expect(result.discount.amount).toBe(5100);
    expect(result.totalAmount.amount).toBe(45900);
    expect(result.items).toHaveLength(2);
  });

  it("handles no discount", () => {
    const items: OrderItemInput[] = [
      { serviceId: "svc-item", quantity: 1 },
    ];

    const result = priceOrder(items, services);

    expect(result.discount.amount).toBe(0);
    expect(result.totalAmount.amount).toBe(15000);
  });

  it("preserves garmentBreakdown when provided", () => {
    const items: OrderItemInput[] = [
      {
        serviceId: "svc-item",
        quantity: 2,
        garmentBreakdown: [
          { name: "Kemeja", qty: 1 },
          { name: "Celana", qty: 1 },
        ],
      },
    ];

    const result = priceOrder(items, services);
    expect(result.items[0].garmentBreakdown).toEqual([
      { name: "Kemeja", qty: 1 },
      { name: "Celana", qty: 1 },
    ]);
  });

  it("nulls out empty garmentBreakdown arrays", () => {
    const items: OrderItemInput[] = [
      {
        serviceId: "svc-item",
        quantity: 1,
        garmentBreakdown: [],
      },
    ];

    const result = priceOrder(items, services);
    expect(result.items[0].garmentBreakdown).toBeNull();
  });

  it("throws when a service is not found", () => {
    const items: OrderItemInput[] = [{ serviceId: "missing", quantity: 1 }];
    expect(() => priceOrder(items, services)).toThrow("Service not found: missing");
  });
});
