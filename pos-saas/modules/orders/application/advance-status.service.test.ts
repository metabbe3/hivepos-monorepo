import { describe, it, expect, vi } from "vitest";
import { AdvanceStatusService } from "./advance-status.service";
import {
  mockOrderRepo,
  testContext,
  testOrderRecord,
} from "./test-helpers";
import {
  NotFoundError,
  InvalidStatusTransitionError,
} from "@/modules/shared";

describe("AdvanceStatusService", () => {
  it("advances status on a valid forward transition", async () => {
    const orderRepo = mockOrderRepo({
      findById: vi.fn().mockResolvedValue(testOrderRecord({ status: "RECEIVED" })),
    });
    const service = new AdvanceStatusService(orderRepo);

    await service.execute(
      "order-1",
      { status: "IN_PROGRESS" },
      testContext(),
    );

    expect(orderRepo.advanceStatus).toHaveBeenCalledWith(
      "order-1",
      "branch-1",
      "IN_PROGRESS",
    );
  });

  it("throws InvalidStatusTransitionError for a skip", async () => {
    const orderRepo = mockOrderRepo({
      findById: vi.fn().mockResolvedValue(testOrderRecord({ status: "RECEIVED" })),
    });
    const service = new AdvanceStatusService(orderRepo);

    await expect(
      service.execute("order-1", { status: "DELIVERED" }, testContext()),
    ).rejects.toThrow(InvalidStatusTransitionError);
  });

  it("throws InvalidStatusTransitionError for backwards move", async () => {
    const orderRepo = mockOrderRepo({
      findById: vi.fn().mockResolvedValue(testOrderRecord({ status: "READY" })),
    });
    const service = new AdvanceStatusService(orderRepo);

    await expect(
      service.execute("order-1", { status: "IN_PROGRESS" }, testContext()),
    ).rejects.toThrow(InvalidStatusTransitionError);
  });

  it("throws InvalidStatusTransitionError from terminal DELIVERED", async () => {
    const orderRepo = mockOrderRepo({
      findById: vi.fn().mockResolvedValue(testOrderRecord({ status: "DELIVERED" })),
    });
    const service = new AdvanceStatusService(orderRepo);

    await expect(
      service.execute("order-1", { status: "RECEIVED" }, testContext()),
    ).rejects.toThrow(InvalidStatusTransitionError);
  });

  it("throws NotFoundError when order does not exist", async () => {
    const orderRepo = mockOrderRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new AdvanceStatusService(orderRepo);

    await expect(
      service.execute("missing", { status: "IN_PROGRESS" }, testContext()),
    ).rejects.toThrow(NotFoundError);
  });
});
