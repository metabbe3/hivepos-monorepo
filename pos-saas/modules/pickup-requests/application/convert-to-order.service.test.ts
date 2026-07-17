import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvertPickupToOrderService } from "./convert-to-order.service";
import { NotFoundError, ConflictError } from "@/modules/shared";
import type { PickupRequest } from "../domain/types";
import type { PickupRequestRepository, CustomerPort } from "../domain/repository.port";
import type { RequestContext } from "./context";

// ── Mocks ────────────────────────────────────────────────────────────────

function mockPickupRepo(
  pickup: PickupRequest | null,
): PickupRequestRepository {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(pickup),
    list: vi.fn(),
    updateStatus: vi.fn(),
    linkConverted: vi.fn().mockResolvedValue({ orderId: "order-1" }),
    countPending: vi.fn(),
  } as PickupRequestRepository;
}

function mockCustomerPort(
  existing: { id: string } | null,
): CustomerPort {
  return {
    findByPhone: vi.fn().mockResolvedValue(existing),
    create: vi.fn().mockResolvedValue({ id: "cust-new" }),
  } as CustomerPort;
}

const orderCreationPort = {
  execute: vi.fn().mockResolvedValue({ id: "order-1" }),
};

beforeEach(() => {
  vi.clearAllMocks();
});

function ctx(): RequestContext {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    branchId: "branch-1",
    branchIds: ["branch-1"],
    isAllOutlets: false,
    permissions: ["pickupRequests:read", "pickupRequests:edit"],
    activeModule: "LAUNDRY",
  };
}

/** Build a SCHEDULED PickupRequest with sensible defaults. */
function scheduledPickup(
  overrides: Partial<PickupRequest> = {},
): PickupRequest {
  return {
    id: "pickup-1",
    tenantId: "tenant-1",
    branchId: "branch-1",
    module: "LAUNDRY",
    customerName: "Test Customer",
    customerPhone: "08123456789",
    customerEmail: null,
    customerId: null,
    latitude: null,
    longitude: null,
    addressText: null,
    mapsLink: null,
    requestedDate: null,
    requestedSlot: null,
    status: "SCHEDULED",
    notes: null,
    assignedDriverId: null,
    convertedOrderId: null,
    convertedAt: null,
    rejectedReason: null,
    rejectedAt: null,
    rejectedById: null,
    acceptedAt: null,
    acceptedById: null,
    scheduledAt: null,
    scheduledById: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("ConvertPickupToOrderService", () => {
  it("throws NotFoundError when the pickup does not exist", async () => {
    const service = new ConvertPickupToOrderService(
      mockPickupRepo(null),
      mockCustomerPort(null),
      orderCreationPort,
    );

    await expect(service.execute("missing", ctx())).rejects.toThrow(
      NotFoundError,
    );
  });

  it("returns the existing orderId when already converted (idempotency)", async () => {
    const pickup = scheduledPickup({
      status: "CONVERTED",
      convertedOrderId: "order-existing",
    });
    const service = new ConvertPickupToOrderService(
      mockPickupRepo(pickup),
      mockCustomerPort(null),
      orderCreationPort,
    );

    const result = await service.execute("pickup-1", ctx());

    expect(result).toEqual({ orderId: "order-existing" });
    expect(orderCreationPort.execute).not.toHaveBeenCalled();
  });

  it("throws ConflictError when status is not SCHEDULED", async () => {
    const service = new ConvertPickupToOrderService(
      mockPickupRepo(scheduledPickup({ status: "PENDING" })),
      mockCustomerPort(null),
      orderCreationPort,
    );

    await expect(service.execute("pickup-1", ctx())).rejects.toThrow(
      ConflictError,
    );
  });

  it("reuses an existing customer (found by phone) when customerId is null", async () => {
    const pickup = scheduledPickup({ customerId: null });
    const customerPort = mockCustomerPort({ id: "cust-existing" });
    const repo = mockPickupRepo(pickup);
    const service = new ConvertPickupToOrderService(
      repo,
      customerPort,
      orderCreationPort,
    );

    const result = await service.execute("pickup-1", ctx());

    expect(customerPort.findByPhone).toHaveBeenCalledWith(
      "08123456789",
      "branch-1",
    );
    expect(customerPort.create).not.toHaveBeenCalled();
    expect(orderCreationPort.execute).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cust-existing", items: [] }),
      expect.anything(),
    );
    expect(repo.linkConverted).toHaveBeenCalledWith(
      "pickup-1",
      ["branch-1"],
      "order-1",
    );
    expect(result).toEqual({ orderId: "order-1" });
  });

  it("creates a new customer when none exists by phone", async () => {
    const pickup = scheduledPickup({
      customerId: null,
      customerEmail: "test@example.com",
    });
    const customerPort = mockCustomerPort(null);
    const repo = mockPickupRepo(pickup);
    const service = new ConvertPickupToOrderService(
      repo,
      customerPort,
      orderCreationPort,
    );

    await service.execute("pickup-1", ctx());

    expect(customerPort.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test Customer",
        phone: "08123456789",
        email: "test@example.com",
        branchId: "branch-1",
        tenantId: "tenant-1",
      }),
    );
    expect(orderCreationPort.execute).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cust-new" }),
      expect.anything(),
    );
  });

  it("skips the customer lookup when customerId is already set on the pickup", async () => {
    const pickup = scheduledPickup({ customerId: "cust-linked" });
    const customerPort = mockCustomerPort(null);
    const service = new ConvertPickupToOrderService(
      mockPickupRepo(pickup),
      customerPort,
      orderCreationPort,
    );

    await service.execute("pickup-1", ctx());

    expect(customerPort.findByPhone).not.toHaveBeenCalled();
    expect(orderCreationPort.execute).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cust-linked" }),
      expect.anything(),
    );
  });

  it("composes order notes with pickup id, address, and customer notes", async () => {
    const pickup = scheduledPickup({
      id: "pickup-9",
      addressText: "Jl. Example",
      notes: "Pakaian formal",
    });
    const service = new ConvertPickupToOrderService(
      mockPickupRepo(pickup),
      mockCustomerPort({ id: "cust-1" }),
      orderCreationPort,
    );

    await service.execute("pickup-9", ctx());

    const call = (orderCreationPort.execute as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.notes).toBe(
      "[Pickup #pickup-9]\nAddress: Jl. Example\nPakaian formal",
    );
  });

  it("notes contain only pickup id when no address or notes", async () => {
    const pickup = scheduledPickup({ id: "pickup-1" });
    const service = new ConvertPickupToOrderService(
      mockPickupRepo(pickup),
      mockCustomerPort({ id: "cust-1" }),
      orderCreationPort,
    );

    await service.execute("pickup-1", ctx());

    const call = (orderCreationPort.execute as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.notes).toBe("[Pickup #pickup-1]");
  });
});
