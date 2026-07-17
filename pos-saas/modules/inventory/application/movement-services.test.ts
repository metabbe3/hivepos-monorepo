import { describe, it, expect, vi } from "vitest";
import { RecordMovementService, ListMovementsService } from "./movement-services";
import { NotFoundError, ValidationError } from "@/modules/shared";
import {
  mockStockItemRepo,
  mockMovementRepo,
  testContext,
  testStockItemRecord,
  testMovement,
} from "./test-helpers";

describe("RecordMovementService", () => {
  it("records an IN movement on happy path", async () => {
    const stockItemRepo = mockStockItemRepo({
      findById: vi.fn().mockResolvedValue(testStockItemRecord({ currentQuantity: 50 })),
    });
    const movementRepo = mockMovementRepo();
    const service = new RecordMovementService(movementRepo, stockItemRepo);

    const result = await service.execute(
      "item-1",
      { type: "IN", quantity: 10, date: "2025-01-01" },
      testContext(),
    );

    expect(result.quantity).toBe(10);
    expect(movementRepo.recordMovement).toHaveBeenCalled();
  });

  it("records an OUT movement when stock is sufficient", async () => {
    const stockItemRepo = mockStockItemRepo({
      findById: vi.fn().mockResolvedValue(testStockItemRecord({ currentQuantity: 20 })),
    });
    const movementRepo = mockMovementRepo({
      recordMovement: vi.fn().mockResolvedValue(testMovement({ quantity: 15, type: "OUT" })),
    });
    const service = new RecordMovementService(movementRepo, stockItemRepo);

    const result = await service.execute(
      "item-1",
      { type: "OUT", quantity: 15, date: "2025-01-01" },
      testContext(),
    );

    expect(result.quantity).toBe(15);
  });

  it("throws ValidationError for OUT that exceeds stock", async () => {
    const stockItemRepo = mockStockItemRepo({
      findById: vi.fn().mockResolvedValue(testStockItemRecord({ currentQuantity: 5 })),
    });
    const movementRepo = mockMovementRepo();
    const service = new RecordMovementService(movementRepo, stockItemRepo);

    await expect(
      service.execute("item-1", { type: "OUT", quantity: 10, date: "2025-01-01" }, testContext()),
    ).rejects.toThrow(ValidationError);

    expect(movementRepo.recordMovement).not.toHaveBeenCalled();
  });

  it("allows OUT that reaches exactly zero", async () => {
    const stockItemRepo = mockStockItemRepo({
      findById: vi.fn().mockResolvedValue(testStockItemRecord({ currentQuantity: 10 })),
    });
    const movementRepo = mockMovementRepo();
    const service = new RecordMovementService(movementRepo, stockItemRepo);

    await service.execute(
      "item-1",
      { type: "OUT", quantity: 10, date: "2025-01-01" },
      testContext(),
    );

    expect(movementRepo.recordMovement).toHaveBeenCalled();
  });

  it("throws NotFoundError when stock item does not exist", async () => {
    const stockItemRepo = mockStockItemRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const movementRepo = mockMovementRepo();
    const service = new RecordMovementService(movementRepo, stockItemRepo);

    await expect(
      service.execute("missing", { type: "IN", quantity: 5, date: "2025-01-01" }, testContext()),
    ).rejects.toThrow(NotFoundError);
  });

  it("passes notes and date through", async () => {
    const stockItemRepo = mockStockItemRepo();
    const movementRepo = mockMovementRepo();
    const service = new RecordMovementService(movementRepo, stockItemRepo);

    await service.execute(
      "item-1",
      { type: "IN", quantity: 5, notes: "Restock", date: "2025-03-15" },
      testContext(),
    );

    expect(movementRepo.recordMovement).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ notes: "Restock" }),
    );
  });
});

describe("ListMovementsService", () => {
  it("returns movements when item exists", async () => {
    const stockItemRepo = mockStockItemRepo();
    const movementRepo = mockMovementRepo({
      findMany: vi.fn().mockResolvedValue([testMovement(), testMovement({ id: "mov-2" })]),
    });
    const service = new ListMovementsService(movementRepo, stockItemRepo);

    const result = await service.execute("item-1", testContext());

    expect(result).toHaveLength(2);
    expect(result[0].quantity).toBe(10);
  });

  it("throws NotFoundError when item does not exist", async () => {
    const stockItemRepo = mockStockItemRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const movementRepo = mockMovementRepo();
    const service = new ListMovementsService(movementRepo, stockItemRepo);

    await expect(
      service.execute("missing", testContext()),
    ).rejects.toThrow(NotFoundError);
  });

  it("returns empty array when no movements", async () => {
    const stockItemRepo = mockStockItemRepo();
    const movementRepo = mockMovementRepo({
      findMany: vi.fn().mockResolvedValue([]),
    });
    const service = new ListMovementsService(movementRepo, stockItemRepo);

    const result = await service.execute("item-1", testContext());

    expect(result).toHaveLength(0);
  });
});
