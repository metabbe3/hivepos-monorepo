import type { PaymentMethod } from "@/app/generated/prisma/enums";

export interface TopCustomer {
  customerId: string;
  name: string;
  orders: number;
  totalSpent: number;
}

export interface ServiceBreakdown {
  serviceId: string;
  name: string;
  orders: number;
  revenue: number;
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod;
  count: number;
  total: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

export interface CashFlow {
  income: number;
  expenses: number;
  net: number;
  walletDeposits: number;
}

export interface OrderPipeline {
  RECEIVED: number;
  IN_PROGRESS: number;
  READY: number;
  DELIVERED: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
  lowStockThreshold: number;
}

export interface CustomerInsights {
  total: number;
  newThisWeek: number;
  active: number;
  atRisk: number;
  lapsed: number;
}

export interface ComparisonMetric {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface Comparison {
  revenue: ComparisonMetric;
  orders: ComparisonMetric;
  expenses: ComparisonMetric;
  netCashFlow: ComparisonMetric;
}

export interface UnpaidOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export interface Stats {
  todayOrders: number;
  inProgress: number;
  readyForPickup: number;
  todayRevenue: number;
  todayOmset: number;
  omsetChange: number | null;
  previousRevenue: number;
  revenueChange: number | null;
  topCustomers: TopCustomer[];
  serviceBreakdown: ServiceBreakdown[];
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  recentOrders: RecentOrder[];
  cashFlow: CashFlow;
  orderPipeline: OrderPipeline;
  lowStock: LowStockItem[];
  customerInsights: CustomerInsights;
  comparison: Comparison;
  unpaidDelivered: number;
  unpaidOrders: UnpaidOrder[];
  turnaround: {
    avgHours: number | null;
    fastestHours: number | null;
    slowestHours: number | null;
    completedCount: number;
  };
  sparkline?: number[];
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  orders: number;
  previousRevenue: number;
}

export interface HeatmapData {
  hourlyByDay: number[][];
  revenueByDay: Record<string, number>;
  customerVisits: {
    customerId: string;
    name: string;
    totalOrders: number;
    dayDistribution: number[];
  }[];
  revenueTrend: RevenueTrendPoint[];
}
