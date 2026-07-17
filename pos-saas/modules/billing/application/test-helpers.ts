import { vi } from "vitest";
import type { BillingRepository, MidtransPort } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type {
  SaaSPaymentRecord,
  TenantInfo,
  SubscriptionInfo,
  BranchCoverageInfo,
  TenantLimits,
  PromoCodeRecord,
  TenantPlan,
} from "../domain/types";
import type { OutletCoverageSummary, PromoValidationResult } from "@/lib/billing";

// ── Mock factory: BillingRepository ──

export function mockBillingRepo(
  overrides: Partial<BillingRepository> = {},
): BillingRepository {
  const repo: BillingRepository = {
    getOutletCoverageStatus: vi
      .fn<(tenantId: string) => Promise<OutletCoverageSummary>>()
      .mockResolvedValue(testCoverageSummary()),
    getTenantLimits: vi
      .fn<(tenantId: string) => Promise<TenantLimits>>()
      .mockResolvedValue(testLimits()),
    isTenantPaid: vi
      .fn<(tenantId: string) => Promise<boolean>>()
      .mockResolvedValue(false),
    validatePromoCode: vi
      .fn<
        (
          code: string,
          tenantId: string,
          planTier?: "GROWTH" | "PRO",
        ) => Promise<PromoValidationResult>
      >()
      .mockResolvedValue({ valid: false }),
    getTenantPlan: vi
      .fn<(tenantId: string) => Promise<TenantPlan>>()
      .mockResolvedValue("FREE"),
    getTierUnitPrice: vi
      .fn<(tier: "GROWTH" | "PRO") => Promise<number>>()
      .mockImplementation(async (tier) => (tier === "PRO" ? 79000 : 49000)),
    redeemPromoCode: vi
      .fn<(promoCodeId: string, tenantId: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    createPayment: vi.fn().mockResolvedValue(testPayment()),
    findPaymentByMidtransOrderId: vi.fn().mockResolvedValue(null),
    updatePaymentSnapToken: vi
      .fn<(paymentId: string, snapToken: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    updatePaymentStatus: vi.fn().mockResolvedValue(undefined),
    markPaymentPaidAndRecompute: vi
      .fn<(tenantId: string, paymentId: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    getTenantInfo: vi
      .fn<(tenantId: string) => Promise<TenantInfo | null>>()
      .mockResolvedValue(testTenant()),
    getSubscription: vi
      .fn<(tenantId: string) => Promise<SubscriptionInfo | null>>()
      .mockResolvedValue(null),
    getRecentPayments: vi.fn().mockResolvedValue([]),
    findBranchesByIds: vi.fn().mockResolvedValue([]),
    countPaidBranches: vi
      .fn<(tenantId: string) => Promise<number>>()
      .mockResolvedValue(1),
  };
  return { ...repo, ...overrides };
}

// ── Mock factory: MidtransPort ──

export function mockMidtransPort(
  overrides: Partial<MidtransPort> = {},
): MidtransPort {
  const port: MidtransPort = {
    isDevMode: false,
    createSnapTransaction: vi.fn().mockResolvedValue(null),
    parseNotification: vi.fn().mockReturnValue({
      orderId: "",
      transactionStatus: "",
    }),
    verifySignature: vi.fn().mockReturnValue(true),
    isSuccessfulStatus: vi
      .fn<(status: string) => boolean>()
      .mockReturnValue(false),
    isFailedStatus: vi
      .fn<(status: string) => boolean>()
      .mockReturnValue(false),
  };
  return { ...port, ...overrides };
}

// ── Test data factories ──

export function testContext(
  overrides: Partial<RequestContext> = {},
): RequestContext {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    permissions: ["billing:read", "billing:create"],
    ...overrides,
  };
}

export function testTenant(overrides: Partial<TenantInfo> = {}): TenantInfo {
  return {
    name: "Test Tenant",
    slug: "test-tenant",
    ownerEmail: "owner@test.com",
    trialEndsAt: null,
    activeModules: ["laundry"],
    ...overrides,
  };
}

export function testLimits(overrides: Partial<TenantLimits> = {}): TenantLimits {
  return {
    maxOutlets: 1,
    maxUsers: 2,
    maxOrders: 100,
    isPaid: false,
    planName: "Free",
    ...overrides,
  };
}

export function testPayment(
  overrides: Partial<SaaSPaymentRecord> = {},
): SaaSPaymentRecord {
  return {
    id: "pay-1",
    tenantId: "tenant-1",
    amount: 49000,
    outletCount: 1,
    monthsPurchased: 1,
    status: "PENDING",
    kind: "RENEWAL",
    branchIds: ["branch-1"],
    promoCodeId: null,
    midtransOrderId: "SUB-20260101-ABCDEF",
    midtransSnapToken: null,
    paidAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function testBranches(
  overrides: Partial<BranchCoverageInfo> = {},
): BranchCoverageInfo[] {
  return [
    {
      id: "branch-1",
      name: "Branch One",
      isFreeTier: false,
      coverageEnd: new Date("2026-12-31"),
      ...overrides,
    },
  ];
}

export function testCoverageSummary(
  overrides: Partial<OutletCoverageSummary> = {},
): OutletCoverageSummary {
  return {
    outlets: [],
    activeCount: 0,
    lockedCount: 0,
    expiringSoon: [],
    latestCoverageEnd: null,
    ...overrides,
  };
}

export function testPromoCode(
  overrides: Partial<PromoCodeRecord> = {},
): PromoCodeRecord {
  return {
    id: "promo-1",
    code: "DISCOUNT10",
    description: "10% off",
    type: "DISCOUNT_PERCENT",
    value: 10,
    maxRedemptions: null,
    redemptionCount: 0,
    validFrom: null,
    validUntil: null,
    isActive: true,
    applicablePlan: null,
    ...overrides,
  };
}
