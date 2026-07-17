import { describe, it, expect } from "vitest";
import { ValidatePromoService } from "./validate-promo.service";
import {
  mockBillingRepo,
  testContext,
  testPromoCode,
} from "./test-helpers";
import { ValidationError } from "@/modules/shared";

describe("ValidatePromoService", () => {
  it("throws ValidationError when code is missing", async () => {
    const service = new ValidatePromoService(mockBillingRepo());

    await expect(
      service.execute({ code: "" }, testContext()),
    ).rejects.toThrow(ValidationError);
  });

  it("returns invalid result when promo validation fails", async () => {
    const repo = mockBillingRepo({
      validatePromoCode: async () => ({
        valid: false,
        error: "Kode promo tidak ditemukan.",
      }),
    });
    const service = new ValidatePromoService(repo);

    const result = await service.execute(
      { code: "BADCODE" },
      testContext(),
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Kode promo tidak ditemukan.");
    expect(result.calculation).toBeUndefined();
  });

  it("calculates bill using provided branchIds", async () => {
    const repo = mockBillingRepo({
      validatePromoCode: async () => ({
        valid: true,
        promoCode: testPromoCode({ type: "DISCOUNT_PERCENT", value: 10 }) as any,
      }),
    });
    const service = new ValidatePromoService(repo);

    const result = await service.execute(
      { code: "DISCOUNT10", branchIds: ["b1", "b2"], months: 3 },
      testContext(),
    );

    expect(result.valid).toBe(true);
    expect(result.calculation!.outletCount).toBe(2);
    expect(result.calculation!.months).toBe(3);
    expect(result.calculation!.grossTotal).toBe(49000 * 2 * 3);
    expect(result.calculation!.discount).toBe(
      Math.round((49000 * 2 * 3 * 10) / 100),
    );
  });

  it("falls back to counting paid branches when branchIds not provided", async () => {
    const repo = mockBillingRepo({
      validatePromoCode: async () => ({
        valid: true,
        promoCode: testPromoCode({ type: "DISCOUNT_PERCENT", value: 10 }) as any,
      }),
      countPaidBranches: async () => 3,
    });
    const service = new ValidatePromoService(repo);

    const result = await service.execute({ code: "DISCOUNT10" }, testContext());

    expect(result.calculation!.outletCount).toBe(3);
    expect(result.calculation!.months).toBe(1);
  });

  it("uses minimum 1 outlet when no paid branches exist", async () => {
    const repo = mockBillingRepo({
      validatePromoCode: async () => ({
        valid: true,
        promoCode: testPromoCode() as any,
      }),
      countPaidBranches: async () => 0,
    });
    const service = new ValidatePromoService(repo);

    const result = await service.execute({ code: "DISCOUNT10" }, testContext());

    expect(result.calculation!.outletCount).toBe(1);
  });

  it("handles FREE_MONTH promo type", async () => {
    const repo = mockBillingRepo({
      validatePromoCode: async () => ({
        valid: true,
        promoCode: testPromoCode({
          type: "FREE_MONTH",
          value: 1,
        }) as any,
      }),
    });
    const service = new ValidatePromoService(repo);

    const result = await service.execute(
      { code: "FREEMONTH", branchIds: ["b1"], months: 3 },
      testContext(),
    );

    expect(result.calculation!.freeMonths).toBe(1);
    expect(result.calculation!.grossTotal).toBe(49000 * 1 * 3);
    // Discount = grossTotal - (price × outlets × (months - freeMonths))
    expect(result.calculation!.discount).toBe(49000);
    expect(result.calculation!.total).toBe(49000 * 2);
  });
});
