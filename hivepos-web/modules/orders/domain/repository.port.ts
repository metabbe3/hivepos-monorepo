import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  BusinessModule,
} from "./types";
import type { PricedItem } from "./pricing";

// ── Persistence shapes ─────────────────────────────────────────────────

/** A persisted order (list view — no nested payments). */
export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  status: OrderStatus;
  module: BusinessModule;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  discountType: string | null;
  paymentStatus: PaymentStatus;
  notes: string | null;
  receivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A persisted order with full detail (items, payments, customer). */
export interface OrderDetailRecord extends OrderRecord {
  inProgressAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  customerBalance: number;
  /** Tenant's QRIS image URL (settings.website.qrisImageUrl) — for the
   * WhatsApp receipt's payment line. null when not configured. */
  qrisUrl: string | null;
  /** Branch receipt/footer terms — drives the WhatsApp receipt {{terms}} block
   * (single source of truth with the printed receipt + tracking page). */
  invoiceFooter: string | null;
  /** Branch thermal-paper size ("56mm" | "58mm" | "80mm" | null) — drives the
   * receipt page's char width. null → caller defaults to 58mm. */
  printerPaperSize: string | null;
  orderItems: Array<{
    id: string;
    serviceId: string;
    serviceName: string;
    quantity: number;
    weightKg: number | null;
    pricePerUnit: number;
    subtotal: number;
    notes: string | null;
    garmentBreakdown: Array<{ name: string; qty: number }> | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    notes: string | null;
    paidAt: Date;
  }>;
}

/** Data needed to create a new order. */
export interface CreateOrderData {
  branchId: string;
  tenantId: string;
  module: BusinessModule;
  orderNumber: string;
  customerId: string;
  totalAmount: number;
  discountAmount: number;
  discountType: string | null;
  receivedAt: Date;
  notes: string | null;
  items: PricedItem[];
  // ponytail: optional idempotency key for offline-created orders. Stored
  // on the row; the API route short-circuits if an order with this clientId
  // already exists. See OrderRepository.findByClientId.
  clientId?: string;
}

/** Data needed to replace an order's items (PUT update). */
export interface ReplaceOrderData {
  customerId: string;
  totalAmount: number;
  discountAmount: number;
  discountType: string | null;
  notes: string | null;
  receivedAt: Date | null;
  orderNumber?: string;
  items: PricedItem[];
}

/** List query filters. */
export interface ListOrdersQuery {
  branchIds: string[];
  module?: BusinessModule;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: "createdAt" | "receivedAt" | "totalAmount" | "customerName";
  sortOrder?: "asc" | "desc";
  page: number;
  limit: number;
}

/** Data needed to record a payment against an order. */
export interface RecordPaymentData {
  orderId: string;
  branchId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes: string | null;
  paidAt: Date;
}

/** Result of recording a payment (includes updated order state). */
export interface RecordPaymentResult {
  payment: {
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    notes: string | null;
    paidAt: Date;
  };
  newPaidAmount: number;
  newPaymentStatus: PaymentStatus;
}

// ── Port interfaces ────────────────────────────────────────────────────

/**
 * Persistence boundary for the Order aggregate.
 *
 * Application services depend on this interface; the infrastructure layer
 * provides a Prisma-backed implementation. Tests mock it.
 */
export interface OrderRepository {
  findById(id: string, branchId: string): Promise<OrderRecord | null>;
  findDetailById(id: string, branchId: string): Promise<OrderDetailRecord | null>;
  list(query: ListOrdersQuery): Promise<{ orders: OrderRecord[]; total: number }>;
  create(data: CreateOrderData): Promise<OrderRecord>;
  updateNotes(id: string, branchId: string, notes: string | null): Promise<OrderRecord>;
  replaceItems(
    id: string,
    branchId: string,
    data: ReplaceOrderData,
  ): Promise<OrderDetailRecord>;
  delete(id: string, branchId: string): Promise<void>;
  advanceStatus(
    id: string,
    branchId: string,
    status: OrderStatus,
  ): Promise<OrderRecord>;
  /** Highest sequence number used for a given date prefix (for order number generation). */
  getLastSequenceForPrefix(prefix: string): Promise<number>;
  /** Idempotency lookup — returns an order previously created with this clientId, or null. */
  findByClientId(clientId: string): Promise<OrderRecord | null>;
}

/**
 * Persistence boundary for payments and deposit deductions.
 *
 * Recording a payment that uses DEPOSIT touches both the Order and Customer
 * aggregates — this port encapsulates that cross-aggregate transaction.
 */
export interface PaymentRepository {
  recordPayment(
    data: RecordPaymentData,
    customerId: string,
  ): Promise<RecordPaymentResult>;
}

/**
 * Read-only access to the customer aggregate (for balance checks).
 * Writes to customer balance happen inside PaymentRepository transactions.
 */
export interface CustomerSnapshot {
  id: string;
  balance: number;
}

export interface CustomerRepository {
  getBalance(customerId: string): Promise<number | null>;
}
