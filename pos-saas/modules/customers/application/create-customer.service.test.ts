import { describe, it, expect, vi } from "vitest";
import { CreateCustomerService } from "./create-customer.service";
import { ConflictError } from "@/modules/shared";
import { mockCustomerRepo, testContext, testCustomerRecord } from "./test-helpers";

function makeService() {
  const customerRepo = mockCustomerRepo();
  const service = new CreateCustomerService(customerRepo);
  return { service, customerRepo };
}

describe("CreateCustomerService", () => {
  it("creates a customer on the happy path", async () => {
    const { service, customerRepo } = makeService();
    customerRepo.create = vi.fn().mockResolvedValue(testCustomerRecord());

    const result = await service.execute(
      { name: "Jane", phone: "08123", email: null, notes: null },
      testContext(),
    );

    expect(result.name).toBe("Test Customer");
    expect(customerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jane", branchId: "branch-1" }),
    );
  });

  it("throws ConflictError when phone already exists", async () => {
    const { service, customerRepo } = makeService();
    customerRepo.findByPhone = vi.fn().mockResolvedValue(testCustomerRecord());

    await expect(
      service.execute({ name: "Jane", phone: "08123" }, testContext()),
    ).rejects.toThrow(ConflictError);
  });

  it("does not check duplicates when phone is empty", async () => {
    const { service, customerRepo } = makeService();
    customerRepo.findByPhone = vi.fn();

    await service.execute({ name: "Jane", phone: "" }, testContext());

    expect(customerRepo.findByPhone).not.toHaveBeenCalled();
  });

  it("does not check duplicates when phone is undefined", async () => {
    const { service, customerRepo } = makeService();
    customerRepo.findByPhone = vi.fn();

    await service.execute({ name: "Jane" }, testContext());

    expect(customerRepo.findByPhone).not.toHaveBeenCalled();
  });
});
