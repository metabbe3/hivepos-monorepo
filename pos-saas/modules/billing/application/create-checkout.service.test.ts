import { describe, it, expect, vi } from "vitest";
import { CreateCheckoutService } from "./create-checkout.service";
import {
  mockBillingRepo,
  mockMidtransPort,
  testContext,
  testTenant,
  testPayment,
  testPromoCode,
} from "./test-helpers";
import { ValidationError, NotFoundError } from "@/modules/shared";

describe("CreateCheckoutService", () => {
  // ── Input validation ──

  it("throws ValidationError when branchIds is empty", async () => {
    const service = new CreateCheckoutService(
      mockBillingRepo(),
      mockMidtransPort(),
    );

    await expect(
      service.execute({ months: 1, branchIds: [] }, testContext()),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when promo code is invalid", async () => {
    const repo = mockBillingRepo({
      validatePromoCode: async () => ({
        valid: false,
        error: "Kode promo tidak ditemukan.",
      }),
    });
    const service = new CreateCheckoutService(repo, mockMidtransPort());

    await expect(
      service.execute(
        { months: 1, branchIds: ["b1"], promoCode: "BADCODE" },
        testContext(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when branchIds do not match tenant branches", async () => {
    const repo = mockBillingRepo({
      findBranchesByIds: async () => [], // 0 found but 1 requested
    });
    const service = new CreateCheckoutService(repo, mockMidtransPort());

    await expect(
      service.execute({ months: 1, branchIds: ["unknown"] }, testContext()),
    ).rejects.toThrow(ValidationError);
  });

  // ── Case 1: Free (total <= 0 via promo) ──

  it("auto-completes when promo makes total 0", async () => {
    const repo = mockBillingRepo({
      validatePromoCode: async () => ({
        valid: true,
        promoCode: {
          ...testPromoCode({ type: "DISCOUNT_FIXED", value: 999999 }),
        } as any,
      }),
      createPayment: async () => testPayment({ id: "pay-free" }),
      findBranchesByIds: async () => [
        { id: "b1", name: "Branch", isFreeTier: false, coverageEnd: null },
      ],
    });
    const midtrans = mockMidtransPort({
      createSnapTransaction: vi.fn(), // should NOT be called
    });
    const service = new CreateCheckoutService(repo, midtrans);

    const result = await service.execute(
      { months: 1, branchIds: ["b1"], promoCode: "MEGA" },
      testContext(),
    );

    expect(result.status).toBe("PAID");
    expect(result.snapToken).toBeNull();
    expect(repo.markPaymentPaidAndRecompute).toHaveBeenCalledWith(
      "tenant-1",
      "pay-free",
    );
    expect(repo.redeemPromoCode).toHaveBeenCalledWith("promo-1", "tenant-1");
    expect(midtrans.createSnapTransaction).not.toHaveBeenCalled();
  });

  // ── Case 2: Dev mode ──

  it("auto-completes in dev mode even with non-zero total", async () => {
    const repo = mockBillingRepo({
      createPayment: async () => testPayment({ id: "pay-dev", amount: 49000 }),
      findBranchesByIds: async () => [
        { id: "b1", name: "Branch", isFreeTier: false, coverageEnd: null },
      ],
    });
    const midtrans = mockMidtransPort({ isDevMode: true });
    const service = new CreateCheckoutService(repo, midtrans);

    const result = await service.execute(
      { months: 1, branchIds: ["b1"] },
      testContext(),
    );

    expect(result.status).toBe("PAID");
    expect(result.devMode).toBe(true);
    expect(result.snapToken).toBeNull();
    expect(repo.markPaymentPaidAndRecompute).toHaveBeenCalledWith(
      "tenant-1",
      "pay-dev",
    );
  });

  // ── Case 3: Real Midtrans ──

  it("creates a Snap transaction when Midtrans is configured", async () => {
    const repo = mockBillingRepo({
      getTenantInfo: async () => testTenant(),
      createPayment: async () =>
        testPayment({ id: "pay-real", midtransOrderId: "SUB-20260101-ABC" }),
      findBranchesByIds: async () => [
        { id: "b1", name: "Branch", isFreeTier: false, coverageEnd: null },
      ],
    });
    const midtrans = mockMidtransPort({
      isDevMode: false,
      createSnapTransaction: vi.fn().mockResolvedValue({
        snapToken: "snap-token-123",
        redirectUrl: "https://app.sandbox.midtrans.com/snap/v3/redir/123",
      }),
    });
    const service = new CreateCheckoutService(repo, midtrans);

    const result = await service.execute(
      { months: 1, branchIds: ["b1"] },
      testContext(),
    );

    expect(result.status).toBe("PENDING");
    expect(result.snapToken).toBe("snap-token-123");
    expect(result.redirectUrl).toContain("midtrans.com");
    expect(repo.updatePaymentSnapToken).toHaveBeenCalledWith(
      "pay-real",
      "snap-token-123",
    );
    expect(repo.markPaymentPaidAndRecompute).not.toHaveBeenCalled();
  });

  it("falls back to auto-complete when Midtrans returns null", async () => {
    const repo = mockBillingRepo({
      getTenantInfo: async () => testTenant(),
      createPayment: async () => testPayment({ id: "pay-fallback" }),
      findBranchesByIds: async () => [
        { id: "b1", name: "Branch", isFreeTier: false, coverageEnd: null },
      ],
    });
    const midtrans = mockMidtransPort({
      isDevMode: false,
      createSnapTransaction: vi.fn().mockResolvedValue(null),
    });
    const service = new CreateCheckoutService(repo, midtrans);

    const result = await service.execute(
      { months: 1, branchIds: ["b1"] },
      testContext(),
    );

    expect(result.status).toBe("PAID");
    expect(result.devMode).toBe(true);
    expect(repo.markPaymentPaidAndRecompute).toHaveBeenCalledWith(
      "tenant-1",
      "pay-fallback",
    );
  });

  it("throws NotFoundError when tenant is missing in real-Midtrans path", async () => {
    const repo = mockBillingRepo({
      getTenantInfo: async () => null,
      findBranchesByIds: async () => [
        { id: "b1", name: "Branch", isFreeTier: false, coverageEnd: null },
      ],
    });
    const midtrans = mockMidtransPort({ isDevMode: false });
    const service = new CreateCheckoutService(repo, midtrans);

    await expect(
      service.execute({ months: 1, branchIds: ["b1"] }, testContext()),
    ).rejects.toThrow(NotFoundError);
  });

  // ── Promo redemption resilience ──

  it("does not fail checkout if promo redemption throws (dev mode)", async () => {
    const repo = mockBillingRepo({
      validatePromoCode: async () => ({
        valid: true,
        promoCode: {
          ...testPromoCode(),
        } as any,
      }),
      redeemPromoCode: vi.fn().mockRejectedValue(new Error("duplicate")),
      findBranchesByIds: async () => [
        { id: "b1", name: "Branch", isFreeTier: false, coverageEnd: null },
      ],
    });
    const midtrans = mockMidtransPort({ isDevMode: true });
    const service = new CreateCheckoutService(repo, midtrans);

    const result = await service.execute(
      { months: 1, branchIds: ["b1"], promoCode: "DISCOUNT10" },
      testContext(),
    );

    // Should still succeed — promo error is swallowed
    expect(result.status).toBe("PAID");
    expect(repo.markPaymentPaidAndRecompute).toHaveBeenCalled();
  });

  // ── Pro no-downgrade guard ──

  it("forces PRO pricing when tenant is already PRO (no downgrade)", async () => {
    const createPayment = vi.fn().mockResolvedValue(testPayment({ id: "pay-pro" }));
    const repo = mockBillingRepo({
      getTenantPlan: async () => "PRO",
      findBranchesByIds: async () => [
        { id: "b1", name: "Branch", isFreeTier: false, coverageEnd: null },
      ],
      createPayment,
    });
    const service = new CreateCheckoutService(repo, mockMidtransPort());

    await service.execute(
      { months: 1, branchIds: ["b1"], planTier: "GROWTH" },
      testContext(),
    );

    // Requested Growth (49k) but tenant is Pro → must record Pro pricing (79k).
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ unitPrice: 79000 }),
    );
  });
});
