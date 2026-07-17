import { prisma } from "@/lib/prisma";
import type {
  CustomerStatsRepository,
  CustomerStats,
  CustomerDateRange,
} from "../domain/repository.port";
import { deriveCustomerStatus, daysSinceLastOrder } from "../domain/customer-status";

export class PrismaCustomerStatsRepository implements CustomerStatsRepository {
  async getStats(
    customerId: string,
    branchId: string,
    dateRange?: CustomerDateRange,
  ): Promise<CustomerStats> {
    const hasDateFilter = dateRange && (dateRange.from || dateRange.to);
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateRange?.from) dateFilter.gte = dateRange.from;
    if (dateRange?.to) dateFilter.lte = dateRange.to;

    const orderWhere = {
      customerId,
      branchId,
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };

    const customer = await prisma.customer.findUnique({
      where: { id: customerId, branchId },
      select: { createdAt: true },
    });

    if (!customer) return emptyStats();

    const [
      orderStats,
      serviceBreakdownGrouped,
      paymentBreakdownGrouped,
      orderDates,
      lastOrderAllTime,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: orderWhere,
        _count: true,
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.orderItem.groupBy({
        by: ["serviceId"],
        where: { order: orderWhere },
        _sum: { subtotal: true },
        _count: true,
        orderBy: { _sum: { subtotal: "desc" } },
      }),
      prisma.payment.groupBy({
        by: ["paymentMethod"],
        where: { order: orderWhere },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.order.findMany({
        where: { customerId, branchId },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.order.findFirst({
        where: { customerId, branchId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    // Resolve service names
    const serviceIds = serviceBreakdownGrouped.map((s) => s.serviceId);
    const services =
      serviceIds.length > 0
        ? await prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true },
          })
        : [];
    const serviceMap = new Map(services.map((s) => [s.id, s.name]));

    const totalSpent = Number(orderStats._sum.totalAmount ?? 0);
    const totalPaid = Number(orderStats._sum.paidAmount ?? 0);
    const totalOrders = orderStats._count;
    const outstandingBalance = totalSpent - totalPaid;
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

    const now = Date.now();
    const lastOrderDate = lastOrderAllTime?.createdAt ?? null;

    let avgDaysBetweenOrders: number | null = null;
    if (orderDates.length >= 2) {
      let totalGap = 0;
      for (let i = 1; i < orderDates.length; i++) {
        totalGap += orderDates[i].createdAt.getTime() - orderDates[i - 1].createdAt.getTime();
      }
      avgDaysBetweenOrders = Math.round(totalGap / (orderDates.length - 1) / (1000 * 60 * 60 * 24));
    }

    return {
      totalOrders,
      totalSpent,
      totalPaid,
      outstandingBalance,
      avgOrderValue,
      daysSinceLastOrder: daysSinceLastOrder(lastOrderDate, now),
      avgDaysBetweenOrders,
      customerStatus: deriveCustomerStatus(customer.createdAt, lastOrderDate, totalOrders, now),
      serviceBreakdown: serviceBreakdownGrouped.map((s) => ({
        serviceId: s.serviceId,
        name: serviceMap.get(s.serviceId) ?? "Unknown",
        orderCount: s._count,
        totalRevenue: Number(s._sum.subtotal ?? 0),
      })),
      paymentMethodBreakdown: paymentBreakdownGrouped.map((p) => ({
        method: p.paymentMethod,
        count: p._count,
        total: Number(p._sum.amount ?? 0),
      })),
    };
  }
}

function emptyStats(): CustomerStats {
  return {
    totalOrders: 0,
    totalSpent: 0,
    totalPaid: 0,
    outstandingBalance: 0,
    avgOrderValue: 0,
    daysSinceLastOrder: null,
    avgDaysBetweenOrders: null,
    customerStatus: "LAPSED",
    serviceBreakdown: [],
    paymentMethodBreakdown: [],
  };
}
