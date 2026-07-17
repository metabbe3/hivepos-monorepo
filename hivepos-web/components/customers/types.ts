import type { CustomerStatus } from "@/lib/constants";

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  customerStatus: CustomerStatus;
  balance: number;
}

export interface OrderItemSummary {
  id: string;
}

export interface OrderPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  createdAt: string;
  orderItems: OrderItemSummary[];
  payments: OrderPayment[];
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  balance: number;
  orders: CustomerOrder[];
}

export interface ServiceBreakdownItem {
  serviceId: string;
  name: string;
  orderCount: number;
  totalRevenue: number;
}

export interface PaymentMethodBreakdownItem {
  method: string;
  count: number;
  total: number;
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
  serviceBreakdown: ServiceBreakdownItem[];
  paymentMethodBreakdown: PaymentMethodBreakdownItem[];
}

export interface DepositTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  paymentMethod: string | null;
  orderId: string | null;
  createdAt: string;
}

/** Flattened payment row used by the Payments tab. */
export interface PaymentHistoryRow extends OrderPayment {
  orderNumber: string;
  orderId: string;
}

export type { CustomerStatus };
