import { describe, it, expect, vi } from "vitest";
import { TopUpDepositService, ListDepositTransactionsService } from "./top-up-deposit.service";
import { NotFoundError, ValidationError } from "@/modules/shared";
import {
  mockCustomerRepo,
  mockDepositRepo,
  testContext,
  testCustomerDetail,
  testDepositTransaction,
} from "./test-helpers";

function makeService() {
  const customerRepo = mockCustomerRepo();
  const depositRepo = mockDepositRepo();
  return {
    service: new TopUpDepositService(depositRepo, customerRepo),
    customerRepo,
    depositRepo,
  };
}

describe("TopUpDepositService", () => {
  it("records a top-up on the happy path", async () => {
    const { service, depositRepo } = makeService();

    const result = await service.execute(
      "cust-1",
      { amount: 50000, description: "Top up" },
      testContext(),
    );

    expect(result.amount).toBe(100000);
    expect(depositRepo.topUp).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000, customerId: "cust-1" }),
    );
  });

  it("throws ValidationError for non-positive amount", async () => {
    const { service } = makeService();

    await expect(
      service.execute("cust-1", { amount: 0 }, testContext()),
    ).rejects.toThrow(ValidationError);

    await expect(
      service.execute("cust-1", { amount: -100 }, testContext()),
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError when customer does not exist", async () => {
    const { service, customerRepo } = makeService();
    customerRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(
      service.execute("missing", { amount: 50000 }, testContext()),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("ListDepositTransactionsService", () => {
  it("returns transactions", async () => {
    const depositRepo = mockDepositRepo({
      listTransactions: vi.fn().mockResolvedValue([testDepositTransaction()]),
    });
    const service = new ListDepositTransactionsService(depositRepo);

    const result = await service.execute("cust-1", testContext());

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(100000);
  });

  it("returns empty array when no transactions", async () => {
    const depositRepo = mockDepositRepo({
      listTransactions: vi.fn().mockResolvedValue([]),
    });
    const service = new ListDepositTransactionsService(depositRepo);

    const result = await service.execute("cust-1", testContext());

    expect(result).toHaveLength(0);
  });
});
