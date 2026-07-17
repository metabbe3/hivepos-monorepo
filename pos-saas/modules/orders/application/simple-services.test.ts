import { describe, it, expect, vi } from "vitest";
import {
  UpdateNotesService,
  GetOrderService,
  ListOrdersService,
  DeleteOrderService,
} from "./simple-services";
import {
  mockOrderRepo,
  testContext,
  testOrderRecord,
  testOrderDetail,
} from "./test-helpers";
import { NotFoundError } from "@/modules/shared";

describe("UpdateNotesService", () => {
  it("updates notes when order exists", async () => {
    const orderRepo = mockOrderRepo({
      findById: vi.fn().mockResolvedValue(testOrderRecord()),
      updateNotes: vi.fn().mockResolvedValue(testOrderRecord({ notes: "new" })),
    });
    const service = new UpdateNotesService(orderRepo);

    const result = await service.execute(
      "order-1",
      { notes: "new note" },
      testContext(),
    );

    expect(orderRepo.updateNotes).toHaveBeenCalledWith(
      "order-1",
      "branch-1",
      "new note",
    );
    expect(result.notes).toBe("new");
  });

  it("throws NotFoundError when order does not exist", async () => {
    const orderRepo = mockOrderRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new UpdateNotesService(orderRepo);

    await expect(
      service.execute("missing", { notes: "x" }, testContext()),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("GetOrderService", () => {
  it("returns the order detail when found", async () => {
    const orderRepo = mockOrderRepo({
      findDetailById: vi.fn().mockResolvedValue(testOrderDetail()),
    });
    const service = new GetOrderService(orderRepo);

    const result = await service.execute("order-1", testContext());

    expect(result.id).toBe("order-1");
    expect(result.customerBalance).toBe(100000);
  });

  it("masks financials for users without discount permission", async () => {
    const orderRepo = mockOrderRepo({
      findDetailById: vi.fn().mockResolvedValue(
        testOrderDetail({
          totalAmount: 50000,
          paidAmount: 25000,
          payments: [
            { id: "p1", amount: 25000, paymentMethod: "CASH", notes: null, paidAt: new Date() },
          ],
        }),
      ),
    });
    const service = new GetOrderService(orderRepo);
    const ctx = testContext({
      permissions: ["orders:read"], // no discount
    });

    const result = await service.execute("order-1", ctx);

    expect(result.paidAmount).toBe(0);
    expect(result.payments).toEqual([]);
  });

  it("throws NotFoundError when order does not exist", async () => {
    const orderRepo = mockOrderRepo({
      findDetailById: vi.fn().mockResolvedValue(null),
    });
    const service = new GetOrderService(orderRepo);

    await expect(service.execute("missing", testContext())).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("ListOrdersService", () => {
  it("lists orders with pagination", async () => {
    const orderRepo = mockOrderRepo({
      list: vi.fn().mockResolvedValue({
        orders: [testOrderRecord(), testOrderRecord({ id: "order-2" })],
        total: 25,
      }),
    });
    const service = new ListOrdersService(orderRepo);

    const result = await service.execute(
      { page: "2", limit: "10" },
      testContext(),
    );

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3); // ceil(25/10) = 3
    expect(result.orders).toHaveLength(2);
  });

  it("defaults to page 1, limit 20", async () => {
    const orderRepo = mockOrderRepo({
      list: vi.fn().mockResolvedValue({ orders: [], total: 0 }),
    });
    const service = new ListOrdersService(orderRepo);

    const result = await service.execute({}, testContext());

    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(0);

    const call = (orderRepo.list as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.page).toBe(1);
    expect(call.limit).toBe(20);
  });

  it("caps limit at 100", async () => {
    const orderRepo = mockOrderRepo({
      list: vi.fn().mockResolvedValue({ orders: [], total: 0 }),
    });
    const service = new ListOrdersService(orderRepo);

    await service.execute({ limit: "500" }, testContext());

    const call = (orderRepo.list as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.limit).toBe(100);
  });

  it("masks financials for users without discount permission", async () => {
    const orderRepo = mockOrderRepo({
      list: vi.fn().mockResolvedValue({
        orders: [testOrderRecord({ paidAmount: 25000 })],
        total: 1,
      }),
    });
    const service = new ListOrdersService(orderRepo);
    const ctx = testContext({ permissions: ["orders:read"] });

    const result = await service.execute({}, ctx);

    expect(result.orders[0].paidAmount).toBe(0);
  });
});

describe("DeleteOrderService", () => {
  it("deletes the order when it exists", async () => {
    const orderRepo = mockOrderRepo({
      findById: vi.fn().mockResolvedValue(testOrderRecord()),
      delete: vi.fn().mockResolvedValue(undefined),
    });
    const service = new DeleteOrderService(orderRepo);

    await service.execute("order-1", testContext());

    expect(orderRepo.delete).toHaveBeenCalledWith("order-1", "branch-1");
  });

  it("throws NotFoundError when order does not exist", async () => {
    const orderRepo = mockOrderRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new DeleteOrderService(orderRepo);

    await expect(service.execute("missing", testContext())).rejects.toThrow(
      NotFoundError,
    );
  });
});
