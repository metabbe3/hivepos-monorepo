import { describe, it, expect, vi } from "vitest";
import { UpdateOrderService } from "./update-order.service";
import {
  mockOrderRepo,
  mockServiceCatalog,
  mockTenantPort,
  testContext,
  testOrderDetail,
  testKgService,
  testItemService,
} from "./test-helpers";
import {
  NotFoundError,
  BusinessRuleError,
} from "@/modules/shared";
import type { UpdateOrderInput } from "./dto";

const validInput: UpdateOrderInput = {
  customerId: "cust-1",
  items: [{ serviceId: "svc-1", quantity: 1, weightKg: 3 }],
};

describe("UpdateOrderService", () => {
  it("updates an order with recalculated pricing", async () => {
    const orderRepo = mockOrderRepo({
      findDetailById: vi.fn().mockResolvedValue(testOrderDetail()),
    });
    const serviceCatalog = mockServiceCatalog([testKgService]);
    const service = new UpdateOrderService(orderRepo, serviceCatalog, mockTenantPort());

    await service.execute("order-1", validInput, testContext());

    expect(orderRepo.replaceItems).toHaveBeenCalledWith(
      "order-1",
      "branch-1",
      expect.objectContaining({
        totalAmount: 21000, // 7000 * 3kg
        items: expect.arrayContaining([
          expect.objectContaining({ subtotal: 21000 }),
        ]),
      }),
    );
  });

  it("throws BusinessRuleError when order is DELIVERED", async () => {
    const orderRepo = mockOrderRepo({
      findDetailById: vi.fn().mockResolvedValue(
        testOrderDetail({ status: "DELIVERED" }),
      ),
    });
    const service = new UpdateOrderService(
      orderRepo,
      mockServiceCatalog([testKgService]),
      mockTenantPort(),
    );

    await expect(
      service.execute("order-1", validInput, testContext()),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when changing customer with deposit payments", async () => {
    const orderRepo = mockOrderRepo({
      findDetailById: vi.fn().mockResolvedValue(
        testOrderDetail({
          customerId: "cust-1",
          payments: [
            { id: "p1", amount: 5000, paymentMethod: "DEPOSIT", notes: null, paidAt: new Date() },
          ],
        }),
      ),
    });
    const service = new UpdateOrderService(
      orderRepo,
      mockServiceCatalog([testKgService]),
      mockTenantPort(),
    );

    await expect(
      service.execute(
        "order-1",
        { ...validInput, customerId: "cust-2" },
        testContext(),
      ),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("allows keeping the same customer even with deposit payments", async () => {
    const orderRepo = mockOrderRepo({
      findDetailById: vi.fn().mockResolvedValue(
        testOrderDetail({
          customerId: "cust-1",
          payments: [
            { id: "p1", amount: 5000, paymentMethod: "DEPOSIT", notes: null, paidAt: new Date() },
          ],
        }),
      ),
    });
    const service = new UpdateOrderService(
      orderRepo,
      mockServiceCatalog([testKgService]),
      mockTenantPort(),
    );

    await service.execute("order-1", validInput, testContext());

    expect(orderRepo.replaceItems).toHaveBeenCalled();
  });

  it("throws NotFoundError when order does not exist", async () => {
    const orderRepo = mockOrderRepo({
      findDetailById: vi.fn().mockResolvedValue(null),
    });
    const service = new UpdateOrderService(
      orderRepo,
      mockServiceCatalog([testKgService]),
      mockTenantPort(),
    );

    await expect(
      service.execute("missing", validInput, testContext()),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when a service is missing", async () => {
    const orderRepo = mockOrderRepo({
      findDetailById: vi.fn().mockResolvedValue(testOrderDetail()),
    });
    const service = new UpdateOrderService(
      orderRepo,
      mockServiceCatalog([]), // no services found
      mockTenantPort(),
    );

    await expect(
      service.execute("order-1", validInput, testContext()),
    ).rejects.toThrow(NotFoundError);
  });
});
