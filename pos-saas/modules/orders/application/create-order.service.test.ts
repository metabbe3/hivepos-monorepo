import { describe, it, expect, vi } from "vitest";
import { CreateOrderService } from "./create-order.service";
import {
  mockOrderRepo,
  mockServiceCatalog,
  mockBranchPort,
  mockLimitPort,
  mockTenantPort,
  mockCustomerLookup,
  testContext,
  testKgService,
  testItemService,
} from "./test-helpers";
import type { CreateOrderInput } from "./dto";
import {
  OutletLockedError,
  SubscriptionLimitReachedError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/shared";

function makeService(overrides: {
  services?: typeof testKgService[];
  customerExists?: boolean;
} = {}) {
  const orderRepo = mockOrderRepo();
  const serviceCatalog = mockServiceCatalog(
    overrides.services ?? [testKgService, testItemService],
  );
  const branchPort = mockBranchPort();
  const limitPort = mockLimitPort();
  const tenantPort = mockTenantPort();
  const customerLookup = mockCustomerLookup(overrides.customerExists ?? true);
  const service = new CreateOrderService(
    orderRepo,
    serviceCatalog,
    branchPort,
    limitPort,
    tenantPort,
    customerLookup,
  );
  return { service, orderRepo, serviceCatalog, branchPort, limitPort, customerLookup };
}

const validInput: CreateOrderInput = {
  customerId: "cust-1",
  items: [
    { serviceId: "svc-1", quantity: 1, weightKg: 3 },
    { serviceId: "svc-2", quantity: 2 },
  ],
};

describe("CreateOrderService", () => {
  it("creates an order with correct pricing on the happy path", async () => {
    const { service, orderRepo } = makeService();

    const result = await service.execute(validInput, testContext());

    // svc-1: 7000 * 3kg = 21000, svc-2: 15000 * 2 = 30000 → 51000
    expect(orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 51000,
        discountAmount: 0,
        orderNumber: expect.stringMatching(/^TT-\d{8}-\d{4}$/),
        items: expect.arrayContaining([
          expect.objectContaining({ serviceId: "svc-1", subtotal: 21000 }),
          expect.objectContaining({ serviceId: "svc-2", subtotal: 30000 }),
        ]),
      }),
    );
  });

  it("applies percentage discount correctly", async () => {
    const { service, orderRepo } = makeService();
    const input: CreateOrderInput = {
      ...validInput,
      discountType: "PERCENTAGE",
      discountAmount: 10,
    };

    await service.execute(input, testContext());

    // 51000 - 10% = 5100 discount
    expect(orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discountAmount: 5100,
        totalAmount: 45900,
      }),
    );
  });

  it("throws OutletLockedError when coverage has expired", async () => {
    const service = new CreateOrderService(
      mockOrderRepo(),
      mockServiceCatalog([testKgService]),
      mockBranchPort({
        id: "branch-1",
        isFreeTier: false,
        coverageEnd: new Date("2020-01-01"), // expired
      }),
      mockLimitPort(),
      mockTenantPort(),
      mockCustomerLookup(),
    );

    await expect(service.execute(validInput, testContext())).rejects.toThrow(
      OutletLockedError,
    );
  });

  it("allows free-tier outlets (not locked)", async () => {
    const service = new CreateOrderService(
      mockOrderRepo(),
      mockServiceCatalog([testKgService]),
      mockBranchPort({
        id: "branch-1",
        isFreeTier: true,
        coverageEnd: null,
      }),
      mockLimitPort(),
      mockTenantPort(),
      mockCustomerLookup(),
    );

    await expect(
      service.execute(
        { ...validInput, items: [{ serviceId: "svc-1", quantity: 1, weightKg: 1 }] },
        testContext(),
      ),
    ).resolves.toBeDefined();
  });

  it("throws SubscriptionLimitReachedError when limit exceeded", async () => {
    const service = new CreateOrderService(
      mockOrderRepo(),
      mockServiceCatalog([testKgService]),
      mockBranchPort(),
      mockLimitPort({
        allowed: false,
        current: 100,
        max: 100,
        reason: "Limit reached",
      }),
      mockTenantPort(),
      mockCustomerLookup(),
    );

    await expect(service.execute(validInput, testContext())).rejects.toThrow(
      SubscriptionLimitReachedError,
    );
  });

  it("throws ForbiddenError when discount applied without permission", async () => {
    const { service } = makeService();
    const ctx = testContext({
      permissions: ["orders:read", "orders:create"], // no "orders:discount"
    });
    const input: CreateOrderInput = {
      ...validInput,
      discountType: "FIXED",
      discountAmount: 5000,
    };

    await expect(service.execute(input, ctx)).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when a service does not exist", async () => {
    const { service } = makeService({
      services: [testKgService], // only svc-1, not svc-2
    });

    await expect(service.execute(validInput, testContext())).rejects.toThrow(
      NotFoundError,
    );
  });

  it("generates the correct sequence-based order number", async () => {
    const orderRepo = mockOrderRepo({
      getLastSequenceForPrefix: vi.fn().mockResolvedValue(5),
    });
    const service = new CreateOrderService(
      orderRepo,
      mockServiceCatalog([testKgService, testItemService]),
      mockBranchPort(),
      mockLimitPort(),
      mockTenantPort(),
      mockCustomerLookup(),
    );

    await service.execute(validInput, testContext());

    const call = (orderRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.orderNumber).toMatch(/-\d{4}$/);
    // Sequence 5 → next is 0006
    expect(call.orderNumber).toMatch(/-0006$/);
  });

  it("uses receivedAt date when provided for order number", async () => {
    const orderRepo = mockOrderRepo();
    const service = new CreateOrderService(
      orderRepo,
      mockServiceCatalog([testKgService, testItemService]),
      mockBranchPort(),
      mockLimitPort(),
      mockTenantPort(),
      mockCustomerLookup(),
    );

    await service.execute(
      { ...validInput, receivedAt: "2025-06-15T00:00:00Z" },
      testContext(),
    );

    const call = (orderRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.orderNumber).toContain("20250615");
  });

  // ── Anti-tamper guards (offline payload hardening) ──────────────────

  it("throws NotFoundError when customerId does not belong to the branch", async () => {
    // ponytail: simulates a tampered offline payload pointing at another
    // tenant's customer. Server must reject — Prisma FK alone isn't enough.
    const { service, customerLookup } = makeService({ customerExists: false });

    await expect(service.execute(validInput, testContext())).rejects.toThrow(
      NotFoundError,
    );
    expect(customerLookup.existsInBranch).toHaveBeenCalledWith(
      "cust-1",
      "branch-1",
    );
  });

  it("throws ForbiddenError when PERCENTAGE discount exceeds 100", async () => {
    const { service } = makeService();
    const input: CreateOrderInput = {
      ...validInput,
      discountType: "PERCENTAGE",
      discountAmount: 150, // tampered
    };

    await expect(service.execute(input, testContext())).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("allows PERCENTAGE discount of exactly 100 (comp / free order)", async () => {
    const { service, orderRepo } = makeService();
    const input: CreateOrderInput = {
      ...validInput,
      discountType: "PERCENTAGE",
      discountAmount: 100,
    };

    await service.execute(input, testContext());

    // 51000 - 100% = 51000 discount, total 0
    expect(orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discountAmount: 51000,
        totalAmount: 0,
      }),
    );
  });
});
