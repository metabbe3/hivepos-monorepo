import { describe, it, expect, vi } from "vitest";
import { RecordPaymentService } from "./record-payment.service";
import {
  mockOrderRepo,
  mockPaymentRepo,
  testContext,
  testOrderDetail,
} from "./test-helpers";
import {
  NotFoundError,
  AmountExceedsBalanceError,
  InsufficientBalanceError,
  BusinessRuleError,
} from "@/modules/shared";
import type { OrderDetailRecord } from "@/modules/orders/domain/repository.port";

function makeService(orderDetail: OrderDetailRecord | null = testOrderDetail()) {
  const orderRepo = mockOrderRepo({
    findDetailById: vi.fn().mockResolvedValue(orderDetail),
  });
  const paymentRepo = mockPaymentRepo();
  const service = new RecordPaymentService(orderRepo, paymentRepo);
  return { service, orderRepo, paymentRepo };
}

describe("RecordPaymentService", () => {
  it("records a cash payment on the happy path", async () => {
    const order = testOrderDetail({ totalAmount: 50000, paidAmount: 0 });
    const { service, paymentRepo } = makeService(order);

    const result = await service.execute(
      "order-1",
      { amount: 20000, paymentMethod: "CASH" },
      testContext(),
    );

    expect(paymentRepo.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 20000,
        paymentMethod: "CASH",
      }),
      "cust-1",
    );
  });

  it("records a deposit payment when customer has sufficient balance", async () => {
    const order = testOrderDetail({
      totalAmount: 50000,
      paidAmount: 0,
      customerBalance: 100000,
    });
    const { service, paymentRepo } = makeService(order);

    await service.execute(
      "order-1",
      { amount: 50000, paymentMethod: "DEPOSIT" },
      testContext(),
    );

    expect(paymentRepo.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: "DEPOSIT" }),
      "cust-1",
    );
  });

  it("throws AmountExceedsBalanceError when payment exceeds remaining", async () => {
    const order = testOrderDetail({
      totalAmount: 50000,
      paidAmount: 40000,
    });
    const { service } = makeService(order);

    await expect(
      service.execute(
        "order-1",
        { amount: 20000, paymentMethod: "CASH" }, // remaining is only 10000
        testContext(),
      ),
    ).rejects.toThrow(AmountExceedsBalanceError);
  });

  it("throws InsufficientBalanceError for DEPOSIT when wallet too low", async () => {
    const order = testOrderDetail({
      totalAmount: 50000,
      paidAmount: 0,
      customerBalance: 10000, // not enough
    });
    const { service } = makeService(order);

    await expect(
      service.execute(
        "order-1",
        { amount: 50000, paymentMethod: "DEPOSIT" },
        testContext(),
      ),
    ).rejects.toThrow(InsufficientBalanceError);
  });

  it("throws NotFoundError when order does not exist", async () => {
    const { service } = makeService(null);

    await expect(
      service.execute(
        "missing",
        { amount: 100, paymentMethod: "CASH" },
        testContext(),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("allows paying exactly the remaining balance", async () => {
    const order = testOrderDetail({
      totalAmount: 50000,
      paidAmount: 30000,
    });
    const { service, paymentRepo } = makeService(order);

    await service.execute(
      "order-1",
      { amount: 20000, paymentMethod: "CASH" },
      testContext(),
    );

    expect(paymentRepo.recordPayment).toHaveBeenCalled();
  });

  it("passes the custom paidAt when provided", async () => {
    const { service, paymentRepo } = makeService();

    await service.execute(
      "order-1",
      {
        amount: 10000,
        paymentMethod: "CASH",
        paidAt: "2025-06-10T12:00:00Z",
      },
      testContext(),
    );

    const call = (paymentRepo.recordPayment as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.paidAt).toEqual(new Date("2025-06-10T12:00:00Z"));
  });

  it("throws BusinessRuleError when paidAt is before the order day", async () => {
    const order = testOrderDetail({ receivedAt: new Date("2025-01-15") });
    const { service } = makeService(order);

    await expect(
      service.execute(
        "order-1",
        { amount: 10000, paymentMethod: "CASH", paidAt: "2025-01-14" },
        testContext(),
      ),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when paidAt is in the future", async () => {
    const { service } = makeService();

    await expect(
      service.execute(
        "order-1",
        { amount: 10000, paymentMethod: "CASH", paidAt: "2099-01-01" },
        testContext(),
      ),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("allows paidAt on the same day as the order", async () => {
    const order = testOrderDetail({ receivedAt: new Date("2025-01-15") });
    const { service, paymentRepo } = makeService(order);

    await service.execute(
      "order-1",
      { amount: 10000, paymentMethod: "CASH", paidAt: "2025-01-15" },
      testContext(),
    );

    expect(paymentRepo.recordPayment).toHaveBeenCalled();
  });
});
