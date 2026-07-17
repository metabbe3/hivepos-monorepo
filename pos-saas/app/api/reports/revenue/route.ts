import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { buildDateFilter } from "@/lib/format";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "read");
  const { branchIds } = ctx;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const { where, hasFilter, dateFilter } = buildDateFilter(fromStr, toStr);
  const paymentWhere = hasFilter ? { order: { ...where, branchId: { in: branchIds } } } : { order: { branchId: { in: branchIds } } };

  const [allOrders, paymentsByMethod, payments, ordersByPayStatus, ordersForDaily] = await Promise.all([
    // All orders aggregate
    prisma.order.aggregate({
      where: { ...where, branchId: { in: branchIds } },
      _count: true,
      _sum: { totalAmount: true, discountAmount: true, paidAmount: true },
    }),
    // Payments by method
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: paymentWhere,
      _sum: { amount: true },
      _count: true,
    }),
    // All payments for daily trend (group by paidAt date)
    prisma.payment.findMany({
      where: paymentWhere,
      select: { paidAt: true, amount: true, paymentMethod: true },
      orderBy: { paidAt: "asc" },
    }),
    // Orders by payment status
    prisma.order.groupBy({
      by: ["paymentStatus"],
      where: { ...where, branchId: { in: branchIds } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    }),
    // Orders for daily order count + gross revenue
    prisma.order.findMany({
      where: { ...where, branchId: { in: branchIds } },
      select: { createdAt: true, receivedAt: true, id: true, totalAmount: true, discountAmount: true },
      orderBy: { receivedAt: "asc" },
    }),
  ]);

  const totalDiscount = Number(allOrders._sum.discountAmount ?? 0);
  const grossRevenue = Number(allOrders._sum.totalAmount ?? 0) + totalDiscount;
  const netRevenue = Number(allOrders._sum.totalAmount ?? 0);

  // Build daily trend
  const dailyMap = new Map<string, { revenue: number; grossRevenue: number; netRevenue: number; orders: Set<string>; byMethod: Record<string, number> }>();
  for (const o of ordersForDaily) {
    const day = new Date(o.receivedAt ?? o.createdAt).toISOString().slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { revenue: 0, grossRevenue: 0, netRevenue: 0, orders: new Set(), byMethod: {} });
    const d = dailyMap.get(day)!;
    d.orders.add(o.id);
    d.grossRevenue += Number(o.totalAmount) + Number(o.discountAmount);
    d.netRevenue += Number(o.totalAmount);
  }
  for (const p of payments) {
    const day = new Date(p.paidAt).toISOString().slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { revenue: 0, grossRevenue: 0, netRevenue: 0, orders: new Set(), byMethod: {} });
    const d = dailyMap.get(day)!;
    const amount = Number(p.amount);
    d.revenue += amount;
    d.byMethod[p.paymentMethod] = (d.byMethod[p.paymentMethod] || 0) + amount;
  }
  const dailyTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, revenue: data.revenue, grossRevenue: data.grossRevenue, netRevenue: data.netRevenue, orders: data.orders.size, byMethod: data.byMethod }));

  return apiSuccess({
    summary: {
      grossRevenue,
      totalDiscount,
      netRevenue,
      totalPaid: Number(allOrders._sum.paidAmount ?? 0),
      ordersCount: allOrders._count,
    },
    byPaymentMethod: paymentsByMethod.map((p) => ({
      method: p.paymentMethod,
      count: p._count,
      total: Number(p._sum.amount ?? 0),
    })),
    dailyTrend,
    byPaymentStatus: ordersByPayStatus.map((o) => ({
      status: o.paymentStatus,
      count: o._count,
      totalAmount: Number(o._sum.totalAmount ?? 0),
      paidAmount: Number(o._sum.paidAmount ?? 0),
    })),
  });
});
