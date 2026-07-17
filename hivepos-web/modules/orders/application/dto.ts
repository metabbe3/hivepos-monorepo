import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  DiscountType,
  OrderItemInput,
} from "../domain/types";
import type {
  OrderRecord,
  OrderDetailRecord,
} from "../domain/repository.port";

// ── Input DTOs (what the API layer passes in) ───────────────────────────

export interface CreateOrderInput {
  customerId: string;
  items: OrderItemInput[];
  notes?: string;
  discountType?: DiscountType;
  discountAmount?: number;
  receivedAt?: string;
  // ponytail: optional idempotency key — when set, the API route dedupes
  // against the clientId column before delegating to CreateOrderService.
  clientId?: string;
}

export type UpdateOrderInput = CreateOrderInput;

export interface RecordPaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  paidAt?: string;
}

export interface UpdateNotesInput {
  notes?: string;
}

export interface ListOrdersInput {
  status?: OrderStatus | "ALL";
  search?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  paymentStatus?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdvanceStatusInput {
  status: OrderStatus;
}

// ── Output DTOs (what the API layer returns to the client) ──────────────
//
// These are the records from the domain, with role-based financial masking
// applied. Numbers are already JS numbers (no Prisma Decimal).

export type OrderListDTO = {
  orders: OrderRecord[];
  total: number;
  page: number;
  totalPages: number;
};

export type OrderDTO = OrderRecord;
export type OrderDetailDTO = OrderDetailRecord;
