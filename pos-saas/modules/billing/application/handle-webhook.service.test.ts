import { describe, it, expect, vi } from "vitest";
import { HandleWebhookService } from "./handle-webhook.service";
import {
  mockBillingRepo,
  mockMidtransPort,
  testPayment,
} from "./test-helpers";
import { ValidationError } from "@/modules/shared";

describe("HandleWebhookService", () => {
  it("throws ValidationError when order_id is missing", async () => {
    const midtrans = mockMidtransPort({
      parseNotification: vi.fn().mockReturnValue({
        orderId: "",
        transactionStatus: "settlement",
      }),
    });
    const service = new HandleWebhookService(mockBillingRepo(), midtrans);

    await expect(service.execute({})).rejects.toThrow(ValidationError);
  });

  it("returns ignored=unknown_order when payment not found", async () => {
    const midtrans = mockMidtransPort({
      parseNotification: vi.fn().mockReturnValue({
        orderId: "SUB-UNKNOWN",
        transactionStatus: "settlement",
      }),
    });
    const repo = mockBillingRepo({
      findPaymentByMidtransOrderId: async () => null,
    });
    const service = new HandleWebhookService(repo, midtrans);

    const result = await service.execute({});

    expect(result.ignored).toBe("unknown_order");
  });

  it("returns ignored=already_paid when payment is already PAID", async () => {
    const midtrans = mockMidtransPort({
      parseNotification: vi.fn().mockReturnValue({
        orderId: "SUB-123",
        transactionStatus: "settlement",
      }),
    });
    const repo = mockBillingRepo({
      findPaymentByMidtransOrderId: async () =>
        testPayment({ status: "PAID" }),
    });
    const service = new HandleWebhookService(repo, midtrans);

    const result = await service.execute({});

    expect(result.ignored).toBe("already_paid");
    expect(repo.markPaymentPaidAndRecompute).not.toHaveBeenCalled();
  });

  it("marks PAID and redeems promo on successful settlement", async () => {
    const midtrans = mockMidtransPort({
      parseNotification: vi.fn().mockReturnValue({
        orderId: "SUB-123",
        transactionStatus: "settlement",
        fraudStatus: "accept",
      }),
      isSuccessfulStatus: vi.fn().mockReturnValue(true),
    });
    const repo = mockBillingRepo({
      findPaymentByMidtransOrderId: async () =>
        testPayment({
          status: "PENDING",
          promoCodeId: "promo-1",
          tenantId: "tenant-1",
        }),
    });
    const service = new HandleWebhookService(repo, midtrans);

    const result = await service.execute({});

    expect(result.status).toBe("PAID");
    expect(repo.redeemPromoCode).toHaveBeenCalledWith("promo-1", "tenant-1");
    expect(repo.markPaymentPaidAndRecompute).toHaveBeenCalledWith(
      "tenant-1",
      "pay-1",
    );
  });

  it("marks PAID on capture status without fraudStatus", async () => {
    const midtrans = mockMidtransPort({
      parseNotification: vi.fn().mockReturnValue({
        orderId: "SUB-123",
        transactionStatus: "capture",
      }),
      isSuccessfulStatus: vi.fn().mockReturnValue(true),
    });
    const repo = mockBillingRepo({
      findPaymentByMidtransOrderId: async () =>
        testPayment({ status: "PENDING" }),
    });
    const service = new HandleWebhookService(repo, midtrans);

    const result = await service.execute({});

    expect(result.status).toBe("PAID");
  });

  it("does NOT mark PAID when fraudStatus is deny", async () => {
    const midtrans = mockMidtransPort({
      parseNotification: vi.fn().mockReturnValue({
        orderId: "SUB-123",
        transactionStatus: "capture",
        fraudStatus: "deny",
      }),
      isSuccessfulStatus: vi.fn().mockReturnValue(true),
      isFailedStatus: vi.fn().mockReturnValue(false),
    });
    const repo = mockBillingRepo({
      findPaymentByMidtransOrderId: async () =>
        testPayment({ status: "PENDING" }),
    });
    const service = new HandleWebhookService(repo, midtrans);

    const result = await service.execute({});

    expect(result.status).toBe("PENDING");
    expect(repo.markPaymentPaidAndRecompute).not.toHaveBeenCalled();
  });

  it("marks FAILED on failed status", async () => {
    const midtrans = mockMidtransPort({
      parseNotification: vi.fn().mockReturnValue({
        orderId: "SUB-123",
        transactionStatus: "expire",
      }),
      isSuccessfulStatus: vi.fn().mockReturnValue(false),
      isFailedStatus: vi.fn().mockReturnValue(true),
    });
    const repo = mockBillingRepo({
      findPaymentByMidtransOrderId: async () =>
        testPayment({ status: "PENDING" }),
    });
    const service = new HandleWebhookService(repo, midtrans);

    const result = await service.execute({});

    expect(result.status).toBe("FAILED");
    expect(repo.updatePaymentStatus).toHaveBeenCalledWith("pay-1", "FAILED");
  });

  it("returns PENDING for unknown statuses", async () => {
    const midtrans = mockMidtransPort({
      parseNotification: vi.fn().mockReturnValue({
        orderId: "SUB-123",
        transactionStatus: "pending",
      }),
      isSuccessfulStatus: vi.fn().mockReturnValue(false),
      isFailedStatus: vi.fn().mockReturnValue(false),
    });
    const repo = mockBillingRepo({
      findPaymentByMidtransOrderId: async () =>
        testPayment({ status: "PENDING" }),
    });
    const service = new HandleWebhookService(repo, midtrans);

    const result = await service.execute({});

    expect(result.status).toBe("PENDING");
    expect(repo.updatePaymentStatus).not.toHaveBeenCalled();
    expect(repo.markPaymentPaidAndRecompute).not.toHaveBeenCalled();
  });

  it("ignores duplicate promo redemption errors", async () => {
    const midtrans = mockMidtransPort({
      parseNotification: vi.fn().mockReturnValue({
        orderId: "SUB-123",
        transactionStatus: "settlement",
        fraudStatus: "accept",
      }),
      isSuccessfulStatus: vi.fn().mockReturnValue(true),
    });
    const repo = mockBillingRepo({
      findPaymentByMidtransOrderId: async () =>
        testPayment({
          status: "PENDING",
          promoCodeId: "promo-1",
          tenantId: "tenant-1",
        }),
      redeemPromoCode: vi.fn().mockRejectedValue(new Error("duplicate")),
    });
    const service = new HandleWebhookService(repo, midtrans);

    // Should still succeed — promo error is swallowed
    const result = await service.execute({});

    expect(result.status).toBe("PAID");
    expect(repo.markPaymentPaidAndRecompute).toHaveBeenCalled();
  });
});
