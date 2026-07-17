import { describe, it, expect, vi, beforeEach } from "vitest";
import { newClientId, shortPendingId } from "./client-id";

describe("client-id helpers", () => {
  it("newClientId returns a unique-looking string per call", () => {
    const a = newClientId();
    const b = newClientId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });

  it("shortPendingId uppercases the first 6 chars", () => {
    expect(shortPendingId("a7f3b2c1-0000-0000-0000-000000000000")).toBe("PENDING-A7F3B2");
  });
});

describe("createOrderOffline", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("writes a pending order + (when walk-in) a pending customer to IDB", async () => {
    const putPendingOrder = vi.fn().mockResolvedValue(undefined);
    const putPendingCustomer = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./db", () => ({
      putPendingOrder,
      putPendingCustomer,
      // not used here but typed in the module
      getDB: vi.fn(),
      listPendingOrders: vi.fn(),
      listPendingCustomers: vi.fn(),
    }));

    const { createOrderOffline } = await import("./offline-order-create");

    const result = await createOrderOffline({
      newCustomer: { name: "Andi", phone: "0812345" },
      items: [{ serviceId: "svc-1", quantity: 1 }],
      pricedItems: [
        {
          serviceName: "Cuci Kering",
          quantity: 1,
          weightKg: null,
          pricePerUnit: 7000,
          subtotal: 7000,
        },
      ],
      totalAmount: 7000,
      branchId: "branch-1",
      module: "LAUNDRY",
    });

    expect(result.orderClientId).not.toBe(result.customerClientId);
    expect(putPendingCustomer).toHaveBeenCalledOnce();
    expect(putPendingOrder).toHaveBeenCalledOnce();

    const orderRow = putPendingOrder.mock.calls[0][0];
    expect(orderRow.status).toBe("pending");
    expect(orderRow.pendingCustomerId).toBe(result.customerClientId);
    expect(orderRow.customerId).toBeUndefined();
    expect(orderRow.pricedItems).toHaveLength(1);
  });

  it("uses existingCustomerId when no newCustomer is provided", async () => {
    const putPendingOrder = vi.fn().mockResolvedValue(undefined);
    const putPendingCustomer = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./db", () => ({
      putPendingOrder,
      putPendingCustomer,
      getDB: vi.fn(),
      listPendingOrders: vi.fn(),
      listPendingCustomers: vi.fn(),
    }));

    const { createOrderOffline } = await import("./offline-order-create");

    const result = await createOrderOffline({
      existingCustomerId: "cust-42",
      items: [{ serviceId: "svc-1", quantity: 2 }],
      pricedItems: [],
      totalAmount: 0,
      branchId: "branch-1",
      module: "LAUNDRY",
    });

    expect(putPendingCustomer).not.toHaveBeenCalled();
    expect(putPendingOrder).toHaveBeenCalledOnce();

    const orderRow = putPendingOrder.mock.calls[0][0];
    expect(orderRow.customerId).toBe("cust-42");
    expect(orderRow.pendingCustomerId).toBeUndefined();
    expect(result.customerClientId).toBeUndefined();
  });
});
