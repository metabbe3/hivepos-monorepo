import type { CustomerStatus, DepositTransactionType, SortField, SortOrder } from "./types";

// ── Persistence shapes ─────────────────────────────────────────────────

/** A persisted customer (list view, no nested orders). */
export interface CustomerRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  balance: number;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A persisted customer with enriched order summary. */
export interface CustomerWithSummary extends CustomerRecord {
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: Date | null;
  customerStatus: CustomerStatus;
}

/** A persisted customer with full order detail. */
export interface CustomerDetailRecord extends CustomerRecord {
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    createdAt: Date;
    orderItems: Array<{ id: string }>;
    payments: Array<{
      id: string;
      amount: number;
      paymentMethod: string;
      createdAt: Date;
    }>;
  }>;
}

/** A deposit transaction record. */
export interface DepositTransactionRecord {
  id: string;
  customerId: string;
  branchId: string;
  type: DepositTransactionType;
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  description: string | null;
  notes: string | null;
  createdAt: Date;
}

// ── Query/input shapes ────────────────────────────────────────────────

export interface ListCustomersQuery {
  branchId: string;
  search?: string;
  sort?: SortField;
  order?: SortOrder;
}

export interface CustomerDateRange {
  from?: Date;
  to?: Date;
}

export interface CreateCustomerData {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  branchId: string;
  // ponytail: optional idempotency key for offline-created walk-in customers.
  clientId?: string;
}

export interface UpdateCustomerData {
  name?: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface TopUpData {
  customerId: string;
  branchId: string;
  amount: number;
  description?: string | null;
  notes?: string | null;
}

// ── Repository ports ───────────────────────────────────────────────────

export interface CustomerRepository {
  findMany(query: ListCustomersQuery): Promise<CustomerWithSummary[]>;
  findById(id: string, branchId: string): Promise<CustomerDetailRecord | null>;
  create(data: CreateCustomerData): Promise<CustomerRecord>;
  update(id: string, branchId: string, data: UpdateCustomerData): Promise<CustomerRecord>;
  delete(id: string, branchId: string): Promise<void>;
  findByPhone(phone: string, branchId: string): Promise<CustomerRecord | null>;
  findByClientId(clientId: string): Promise<CustomerRecord | null>;
  countOrders(customerId: string, branchId: string): Promise<number>;
}

export interface DepositRepository {
  listTransactions(customerId: string, limit?: number): Promise<DepositTransactionRecord[]>;
  topUp(data: TopUpData): Promise<DepositTransactionRecord>;
}

export interface CustomerStatsRepository {
  getStats(
    customerId: string,
    branchId: string,
    dateRange?: CustomerDateRange,
  ): Promise<CustomerStats>;
}

export interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  totalPaid: number;
  outstandingBalance: number;
  avgOrderValue: number;
  daysSinceLastOrder: number | null;
  avgDaysBetweenOrders: number | null;
  customerStatus: CustomerStatus;
  serviceBreakdown: Array<{
    serviceId: string;
    name: string;
    orderCount: number;
    totalRevenue: number;
  }>;
  paymentMethodBreakdown: Array<{
    method: string;
    count: number;
    total: number;
  }>;
}
