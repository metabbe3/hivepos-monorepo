import { vi } from "vitest";
import type {
  OrderRepository,
  PaymentRepository,
  OrderRecord,
  OrderDetailRecord,
  CreateOrderData,
  ReplaceOrderData,
  ListOrdersQuery,
  RecordPaymentData,
  RecordPaymentResult,
} from "../domain/repository.port";
import type {
  ServiceCatalogPort,
  BranchPort,
  OrderLimitPort,
  TenantPort,
  CustomerLookupPort,
  BranchCoverageInfo,
  OrderLimitResult,
} from "./ports";
import type { ServicePricing } from "../domain/types";
import type { RequestContext } from "./context";

/** Deep-mock for OrderRepository — every method is a vi.fn(). */
export function mockOrderRepo(overrides: Partial<OrderRepository> = {}): OrderRepository {
  return {
    findById: vi.fn<(id: string, branchId: string) => Promise<OrderRecord | null>>()
      .mockResolvedValue(null),
    findDetailById: vi.fn<(id: string, branchId: string) => Promise<OrderDetailRecord | null>>()
      .mockResolvedValue(null),
    list: vi.fn<(q: ListOrdersQuery) => Promise<{ orders: OrderRecord[]; total: number }>>()
      .mockResolvedValue({ orders: [], total: 0 }),
    create: vi.fn<(d: CreateOrderData) => Promise<OrderRecord>>()
      .mockResolvedValue({} as OrderRecord),
    updateNotes: vi.fn<(id: string, b: string, n: string | null) => Promise<OrderRecord>>()
      .mockResolvedValue({} as OrderRecord),
    replaceItems: vi.fn<(id: string, b: string, d: ReplaceOrderData) => Promise<OrderDetailRecord>>()
      .mockResolvedValue({} as OrderDetailRecord),
    delete: vi.fn<(id: string, b: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    advanceStatus: vi.fn<(id: string, b: string, s: never) => Promise<OrderRecord>>()
      .mockResolvedValue({} as OrderRecord),
    getLastSequenceForPrefix: vi.fn<(p: string) => Promise<number>>()
      .mockResolvedValue(0),
    ...overrides,
  } as OrderRepository;
}

export function mockPaymentRepo(
  overrides: Partial<PaymentRepository> = {},
): PaymentRepository {
  return {
    recordPayment: vi.fn<
      (d: RecordPaymentData, c: string) => Promise<RecordPaymentResult>
    >().mockResolvedValue({} as RecordPaymentResult),
    ...overrides,
  } as PaymentRepository;
}

export function mockServiceCatalog(
  services: ServicePricing[] = [],
): ServiceCatalogPort {
  return {
    findPricingForServices: vi.fn().mockResolvedValue(services),
  };
}

export function mockBranchPort(
  coverage: BranchCoverageInfo | null = {
    id: "branch-1",
    isFreeTier: false,
    coverageEnd: new Date("2099-01-01"),
  },
): BranchPort {
  return {
    getCoverage: vi.fn().mockResolvedValue(coverage),
  };
}

export function mockLimitPort(
  result: OrderLimitResult = {
    allowed: true,
    current: 0,
    max: 100,
  },
): OrderLimitPort {
  return {
    checkOrderLimit: vi.fn().mockResolvedValue(result),
  };
}

/** Mock TenantPort — returns a slug whose derived code is predictable in tests. */
export function mockTenantPort(slug: string | null = "test-tenant"): TenantPort {
  return {
    getSlug: vi.fn().mockResolvedValue(slug),
  };
}

/** Mock CustomerLookupPort — default returns true (customer is in branch). */
export function mockCustomerLookup(exists = true): CustomerLookupPort {
  return {
    existsInBranch: vi.fn().mockResolvedValue(exists),
  };
}

/** A standard request context for tests. */
export function testContext(
  overrides: Partial<RequestContext> = {},
): RequestContext {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    branchId: "branch-1",
    branchIds: ["branch-1"],
    isAllOutlets: false,
    permissions: ["orders:read", "orders:create", "orders:edit", "orders:delete", "orders:discount"],
    activeModule: "LAUNDRY",
    ...overrides,
  };
}

/** A standard service pricing snapshot for tests. */
export const testKgService: ServicePricing = {
  id: "svc-1",
  basePrice: 7000,
  pricingType: "PER_KG",
  module: "LAUNDRY",
};

export const testItemService: ServicePricing = {
  id: "svc-2",
  basePrice: 15000,
  pricingType: "PER_ITEM",
  module: "LAUNDRY",
};

/** A standard order record for tests. */
export function testOrderRecord(
  overrides: Partial<OrderRecord> = {},
): OrderRecord {
  return {
    id: "order-1",
    orderNumber: "TT-20250115-0001",
    customerId: "cust-1",
    customerName: "Test Customer",
    customerPhone: "08123456789",
    status: "RECEIVED",
    module: "LAUNDRY",
    totalAmount: 50000,
    paidAmount: 0,
    discountAmount: 0,
    discountType: null,
    paymentStatus: "PENDING",
    notes: null,
    receivedAt: new Date("2025-01-15"),
    createdAt: new Date("2025-01-15"),
    updatedAt: new Date("2025-01-15"),
    ...overrides,
  };
}

export function testOrderDetail(
  overrides: Partial<OrderDetailRecord> = {},
): OrderDetailRecord {
  return {
    ...testOrderRecord(),
    inProgressAt: null,
    readyAt: null,
    deliveredAt: null,
    customerBalance: 100000,
    qrisUrl: null,
    invoiceFooter: null,
    printerPaperSize: null,
    orderItems: [],
    payments: [],
    ...overrides,
  };
}
