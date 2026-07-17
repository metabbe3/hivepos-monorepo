import { vi } from "vitest";
import type { BusinessModule } from "../domain/types";
import type {
  ServiceRepository,
  ServiceGroupRepository,
  ServiceWithGroup,
  ServiceGroupWithCount,
  ServiceRecord,
} from "../domain/repository.port";

export function testService(overrides: Partial<ServiceWithGroup> = {}): ServiceWithGroup {
  return {
    id: "svc-1",
    name: "Cuci Kering",
    description: null,
    pricingType: "PER_KG",
    basePrice: 7000,
    commissionType: "NONE",
    commissionValue: 0,
    module: "LAUNDRY",
    isActive: true,
    isDefaultSpeed: false,
    branchId: "branch-1",
    groupId: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    group: null,
    ...overrides,
  };
}

export function testServiceRecord(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  const { group: _group, ...rest } = testService(overrides);
  return rest;
}

export function testGroup(overrides: Partial<ServiceGroupWithCount> = {}): ServiceGroupWithCount {
  return {
    id: "grp-1",
    name: "Kiloan",
    description: null,
    sortOrder: 0,
    module: "LAUNDRY",
    branchId: "branch-1",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    serviceCount: 3,
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

export function mockServiceRepo(overrides: Partial<ServiceRepository> = {}): ServiceRepository {
  return {
    findMany: vi.fn().mockResolvedValue([testService()]),
    findInactiveByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(testService()),
    reactivate: vi.fn().mockResolvedValue(testService()),
    update: vi.fn().mockResolvedValue(testService()),
    softDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function mockGroupRepo(
  overrides: Partial<ServiceGroupRepository> = {},
): ServiceGroupRepository {
  return {
    findMany: vi.fn().mockResolvedValue([testGroup()]),
    findById: vi.fn().mockResolvedValue(testGroup()),
    getMaxSortOrder: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(testGroup()),
    update: vi.fn().mockResolvedValue(testGroup()),
    delete: vi.fn().mockResolvedValue(undefined),
    ungroupServices: vi.fn().mockResolvedValue(undefined),
    reorder: vi.fn().mockResolvedValue(undefined),
    countByIds: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}
