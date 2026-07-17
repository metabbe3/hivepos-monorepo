import type { CustomerStatus, DepositTransactionType, SortField, SortOrder } from "../domain/types";

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  // ponytail: optional idempotency key — when set, the API route dedupes
  // against the clientId column AND the existing phone column before
  // delegating to CreateCustomerService.
  clientId?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface ListCustomersInput {
  search?: string;
  sort?: SortField;
  order?: SortOrder;
  status?: CustomerStatus | "";
}

export interface TopUpInput {
  amount: number;
  description?: string | null;
  notes?: string | null;
}

export interface CustomerDateRangeInput {
  from?: string;
  to?: string;
}

export interface CustomerListDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  balance: number;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  customerStatus: CustomerStatus;
}

export interface CustomerDetailDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  balance: number;
  createdAt: string;
  updatedAt: string;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    createdAt: string;
    itemCount: number;
    payments: Array<{
      id: string;
      amount: number;
      paymentMethod: string;
      createdAt: string;
    }>;
  }>;
}

export interface DepositTransactionDTO {
  id: string;
  customerId: string;
  type: DepositTransactionType;
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  description: string | null;
  notes: string | null;
  createdAt: string;
}
