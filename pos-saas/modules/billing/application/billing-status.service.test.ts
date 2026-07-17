import { describe, it, expect } from "vitest";
import { GetBillingStatusService } from "./billing-status.service";
import {
  mockBillingRepo,
  testContext,
  testTenant,
  testLimits,
  testPayment,
  testCoverageSummary,
} from "./test-helpers";
import { NotFoundError } from "@/modules/shared";

describe("GetBillingStatusService", () => {
  it("returns a complete billing status DTO", async () => {
    const coverageEnd = new Date("2026-12-31");
    const repo = mockBillingRepo({
      getTenantInfo: async () => testTenant({ name: "My Biz" }),
      getSubscription: async () => ({
        status: "ACTIVE",
        planName: "Growth",
        currentPeriodEnd: coverageEnd,
      }),
      getRecentPayments: async () => [
        testPayment({ status: "PAID", paidAt: new Date("2026-01-01") }),
      ],
      getTenantLimits: async () =>
        testLimits({ isPaid: true, planName: "Growth", maxOutlets: 999999 }),
      getOutletCoverageStatus: async () =>
        testCoverageSummary({
          activeCount: 1,
          latestCoverageEnd: coverageEnd,
          outlets: [
            {
              id: "b1",
              name: "Main",
              coverageEnd,
              isFreeTier: false,
              status: "ACTIVE",
              expiresInDays: 200,
            },
          ],
        }),
      isTenantPaid: async () => true,
    });

    const service = new GetBillingStatusService(repo);
    const dto = await service.execute(testContext());

    expect(dto.tenant.name).toBe("My Biz");
    expect(dto.subscription?.status).toBe("ACTIVE");
    expect(dto.subscription?.currentPeriodEnd).toBe(coverageEnd.toISOString());
    expect(dto.outlets).toHaveLength(1);
    expect(dto.activeCount).toBe(1);
    expect(dto.limits.isPaid).toBe(true);
    expect(dto.limits.planName).toBe("Growth");
    expect(dto.payments).toHaveLength(1);
    expect(dto.payments[0].amount).toBe(49000);
    expect(dto.pricing.unitPrice).toBe(49000);
  });

  it("returns null subscription when no subscription exists", async () => {
    const repo = mockBillingRepo({
      getSubscription: async () => null,
    });
    const service = new GetBillingStatusService(repo);
    const dto = await service.execute(testContext());

    expect(dto.subscription).toBeNull();
  });

  it("throws NotFoundError when tenant is missing", async () => {
    const repo = mockBillingRepo({
      getTenantInfo: async () => null,
    });
    const service = new GetBillingStatusService(repo);

    await expect(service.execute(testContext())).rejects.toThrow(NotFoundError);
  });

  it("formats expiringSoon outlets with ISO dates", async () => {
    const expiringDate = new Date("2026-07-10");
    const repo = mockBillingRepo({
      getOutletCoverageStatus: async () =>
        testCoverageSummary({
          expiringSoon: [
            {
              id: "b2",
              name: "Expiring Branch",
              coverageEnd: expiringDate,
              isFreeTier: false,
              status: "EXPIRING",
              expiresInDays: 20,
            },
          ],
        }),
    });
    const service = new GetBillingStatusService(repo);
    const dto = await service.execute(testContext());

    expect(dto.expiringSoon).toHaveLength(1);
    expect(dto.expiringSoon[0].coverageEnd).toBe(expiringDate.toISOString());
    expect(dto.expiringSoon[0].expiresInDays).toBe(20);
  });
});
