import { vi } from "vitest";
import type { BusinessModule } from "../domain/types";
import type {
  StockItemRepository,
  StockMovementRepository,
  StockItemRecord,
  StockItemWithCount,
  StockMovementRecord,
} from "../domain/repository.port";

export function testStockItem(
  overrides: Partial<StockItemWithCount> = {},
): StockItemWithCount {
  return {
    id: "item-1",
    name: "Detergent",
    unit: "kg",
    currentQuantity: 50,
    lowStockThreshold: 10,
    purchasePricePerUnit: 15000,
    isActive: true,
    branchId: "branch-1",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    movementCount: 3,
    ...overrides,
  };
}

export function testStockItemRecord(
  overrides: Partial<StockItemRecord> = {},
): StockItemRecord {
  const { movementCount: _count, ...rest } = testStockItem(overrides);
  return rest;
}

export function testMovement(
  overrides: Partial<StockMovementRecord> = {},
): StockMovementRecord {
  return {
    id: "mov-1",
    stockItemId: "item-1",
    type: "IN",
    quantity: 10,
    date: new Date("2025-01-01"),
    notes: null,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function testContext(overrides: Partial<{
  userId: string;
  tenantId: string;
  branchId: string;
  branchIds: string[];
  isAllOutlets: boolean;
  permissions: string[];
  activeModule: BusinessModule;
}> = {}) {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    branchId: "branch-1",
    branchIds: ["branch-1"],
    isAllOutlets: false,
    permissions: ["*:full"],
    activeModule: "LAUNDRY" as BusinessModule,
    ...overrides,
  };
}

export function mockStockItemRepo(
  overrides: Partial<StockItemRepository> = {},
): StockItemRepository {
  return {
    findMany: vi.fn().mockResolvedValue([testStockItem()]),
    findById: vi.fn().mockResolvedValue(testStockItemRecord()),
    create: vi.fn().mockResolvedValue(testStockItemRecord()),
    update: vi.fn().mockResolvedValue(testStockItemRecord()),
    softDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function mockMovementRepo(
  overrides: Partial<StockMovementRepository> = {},
): StockMovementRepository {
  return {
    findMany: vi.fn().mockResolvedValue([testMovement()]),
    recordMovement: vi.fn().mockResolvedValue(testMovement()),
    ...overrides,
  };
}
