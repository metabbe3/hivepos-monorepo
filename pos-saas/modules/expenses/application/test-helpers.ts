import { vi } from "vitest";
import type { BusinessModule } from "@/modules/orders/domain/types";
import type {
  ExpenseRepository,
  ExpenseCategoryRepository,
  ExpenseWithCategory,
  ExpenseCategoryRecord,
} from "../domain/repository.port";

export function testExpense(overrides: Partial<ExpenseWithCategory> = {}): ExpenseWithCategory {
  return {
    id: "exp-1",
    amount: 50000,
    description: "Restock detergent",
    date: new Date("2025-01-15"),
    branchId: "branch-1",
    categoryId: "cat-1",
    createdAt: new Date("2025-01-15"),
    category: { id: "cat-1", name: "Supplies", description: null, branchId: "branch-1", createdAt: new Date("2025-01-01") },
    ...overrides,
  };
}

export function testCategory(overrides: Partial<ExpenseCategoryRecord> = {}): ExpenseCategoryRecord {
  return {
    id: "cat-1",
    name: "Supplies",
    description: null,
    branchId: "branch-1",
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

export function mockExpenseRepo(overrides: Partial<ExpenseRepository> = {}): ExpenseRepository {
  return {
    findMany: vi.fn().mockResolvedValue([testExpense()]),
    create: vi.fn().mockResolvedValue(testExpense()),
    update: vi.fn().mockResolvedValue(testExpense()),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function mockCategoryRepo(
  overrides: Partial<ExpenseCategoryRepository> = {},
): ExpenseCategoryRepository {
  return {
    findMany: vi.fn().mockResolvedValue([testCategory()]),
    create: vi.fn().mockResolvedValue(testCategory()),
    update: vi.fn().mockResolvedValue(testCategory()),
    delete: vi.fn().mockResolvedValue(undefined),
    countExpenses: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}
