import { describe, it, expect, vi } from "vitest";
import { GetCustomerService, UpdateCustomerService, DeleteCustomerService } from "./simple-services";
import { NotFoundError, BusinessRuleError } from "@/modules/shared";
import {
  mockCustomerRepo,
  testContext,
  testCustomerDetail,
  testCustomerRecord,
} from "./test-helpers";

function makeService() {
  const customerRepo = mockCustomerRepo();
  return { customerRepo };
}

describe("GetCustomerService", () => {
  it("returns customer detail with orders", async () => {
    const { customerRepo } = makeService();
    customerRepo.findById = vi.fn().mockResolvedValue(testCustomerDetail());
    const service = new GetCustomerService(customerRepo);

    const result = await service.execute("cust-1", {}, testContext());

    expect(result.id).toBe("cust-1");
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].itemCount).toBe(2);
  });

  it("throws NotFoundError when customer does not exist", async () => {
    const { customerRepo } = makeService();
    customerRepo.findById = vi.fn().mockResolvedValue(null);
    const service = new GetCustomerService(customerRepo);

    await expect(
      service.execute("missing", {}, testContext()),
    ).rejects.toThrow(NotFoundError);
  });

  it("filters orders by date range", async () => {
    const detail = testCustomerDetail({
      orders: [
        { ...testCustomerDetail().orders[0], createdAt: new Date("2025-01-01T00:00:00Z") },
        { ...testCustomerDetail().orders[0], id: "order-2", createdAt: new Date("2025-05-01T00:00:00Z") },
      ],
    });
    const { customerRepo } = makeService();
    customerRepo.findById = vi.fn().mockResolvedValue(detail);
    const service = new GetCustomerService(customerRepo);

    const result = await service.execute(
      "cust-1",
      { from: "2025-04-01", to: "2025-06-01" },
      testContext(),
    );

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].id).toBe("order-2");
  });
});

describe("UpdateCustomerService", () => {
  it("updates and returns the customer", async () => {
    const { customerRepo } = makeService();
    customerRepo.update = vi.fn().mockResolvedValue(testCustomerRecord({ name: "Updated" }));
    const service = new UpdateCustomerService(customerRepo);

    const result = await service.execute("cust-1", { name: "Updated" }, testContext());

    expect(result.name).toBe("Updated");
  });
});

describe("DeleteCustomerService", () => {
  it("deletes when customer has no orders", async () => {
    const { customerRepo } = makeService();
    customerRepo.countOrders = vi.fn().mockResolvedValue(0);
    const service = new DeleteCustomerService(customerRepo);

    await service.execute("cust-1", testContext());

    expect(customerRepo.delete).toHaveBeenCalledWith("cust-1", "branch-1");
  });

  it("throws BusinessRuleError when customer has orders", async () => {
    const { customerRepo } = makeService();
    customerRepo.countOrders = vi.fn().mockResolvedValue(5);
    const service = new DeleteCustomerService(customerRepo);

    await expect(
      service.execute("cust-1", testContext()),
    ).rejects.toThrow(BusinessRuleError);

    expect(customerRepo.delete).not.toHaveBeenCalled();
  });
});
