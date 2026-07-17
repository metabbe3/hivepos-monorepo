import { vi } from "vitest";
import type {
  CustomerRepository,
  DepositRepository,
  CustomerStatsRepository,
  CustomerRecord,
  CustomerWithSummary,
  CustomerDetailRecord,
  DepositTransactionRecord,
  CustomerStats,
} from "../domain/repository.port";
import type { BusinessModule } from "@/modules/orders/domain/types";
import type { RequestContext } from "./context";

// ── Mock factories ─────────────────────────────────────────────────────

export function mockCustomerRepo(overrides: Partial<CustomerRepository> = {}): CustomerRepository {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(testCustomerDetail()),
    create: vi.fn().mockResolvedValue(testCustomerRecord()),
    update: vi.fn().mockResolvedValue(testCustomerRecord()),
    delete: vi.fn().mockResolvedValue(undefined),
    findByPhone: vi.fn().mockResolvedValue(null),
    findByClientId: vi.fn().mockResolvedValue(null),
    countOrders: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

export function mockDepositRepo(overrides: Partial<DepositRepository> = {}): DepositRepository {
  return {
    listTransactions: vi.fn().mockResolvedValue([]),
    topUp: vi.fn().mockResolvedValue(testDepositTransaction()),
    ...overrides,
  };
}

export function mockStatsRepo(overrides: Partial<CustomerStatsRepository> = {}): CustomerStatsRepository {
  return {
    getStats: vi.fn().mockResolvedValue(testCustomerStats()),
    ...overrides,
  };
}

// ── Test data factories ────────────────────────────────────────────────

export function testContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    branchId: "branch-1",
    branchIds: ["branch-1"],
    isAllOutlets: false,
    permissions: [],
    activeModule: "LAUNDRY" as BusinessModule,
    ...overrides,
  };
}

export function testCustomerRecord(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: "cust-1",
    name: "Test Customer",
    phone: "08123456789",
    email: null,
    notes: null,
    balance: 50000,
    branchId: "branch-1",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function testCustomerWithSummary(overrides: Partial<CustomerWithSummary> = {}): CustomerWithSummary {
  return {
    ...testCustomerRecord(),
    totalOrders: 5,
    totalSpent: 250000,
    lastOrderDate: new Date("2025-06-01T00:00:00Z"),
    customerStatus: "ACTIVE",
    ...overrides,
  };
}

export function testCustomerDetail(overrides: Partial<CustomerDetailRecord> = {}): CustomerDetailRecord {
  return {
    ...testCustomerRecord(),
    orders: [
      {
        id: "order-1",
        orderNumber: "HBL-20250601-0001",
        status: "DELIVERED",
        totalAmount: 50000,
        paidAmount: 50000,
        createdAt: new Date("2025-06-01T00:00:00Z"),
        orderItems: [{ id: "item-1" }, { id: "item-2" }],
        payments: [
          {
            id: "pay-1",
            amount: 50000,
            paymentMethod: "CASH",
            createdAt: new Date("2025-06-01T00:00:00Z"),
          },
        ],
      },
    ],
    ...overrides,
  };
}

export function testDepositTransaction(overrides: Partial<DepositTransactionRecord> = {}): DepositTransactionRecord {
  return {
    id: "txn-1",
    customerId: "cust-1",
    branchId: "branch-1",
    type: "TOP_UP",
    amount: 100000,
    balanceAfter: 150000,
    orderId: null,
    description: "Initial top-up",
    notes: null,
    createdAt: new Date("2025-06-01T00:00:00Z"),
    ...overrides,
  };
}

export function testCustomerStats(overrides: Partial<CustomerStats> = {}): CustomerStats {
  return {
    totalOrders: 5,
    totalSpent: 250000,
    totalPaid: 200000,
    outstandingBalance: 50000,
    avgOrderValue: 50000,
    daysSinceLastOrder: 10,
    avgDaysBetweenOrders: 15,
    customerStatus: "ACTIVE",
    serviceBreakdown: [
      { serviceId: "svc-1", name: "Cuci Kering", orderCount: 3, totalRevenue: 150000 },
    ],
    paymentMethodBreakdown: [
      { method: "CASH", count: 4, total: 200000 },
    ],
    ...overrides,
  };
}
