import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { UNPAID_PAYMENT_STATUSES } from "@/lib/constants";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { buildDateFilter } from "@/lib/format";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "read");
  const { branchIds } = ctx;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const { where: orderWhere } = buildDateFilter(fromStr, toStr);
  const { where: customerWhere } = buildDateFilter(fromStr, toStr);
  const { hasFilter, dateFilter } = buildDateFilter(fromStr, toStr);

  // Expense date filter
  const expenseDateFilter: Record<string, unknown> = {};
  if (fromStr) expenseDateFilter.date = { ...(expenseDateFilter.date as object), gte: new Date(fromStr) };
  if (toStr) expenseDateFilter.date = { ...(expenseDateFilter.date as object), lte: new Date(toStr + "T23:59:59") };
  const expenseWhere = {
    branchId: { in: branchIds },
    ...(Object.keys(expenseDateFilter).length > 0 ? expenseDateFilter : {}),
  };

  const itemWhere = hasFilter ? { order: { createdAt: dateFilter, branchId: { in: branchIds } } } : { order: { branchId: { in: branchIds } } };
  const paymentWhere = hasFilter ? { order: { createdAt: dateFilter, branchId: { in: branchIds } } } : { order: { branchId: { in: branchIds } } };

  const [
    // 1. Revenue aggregates (delivered orders)
    orderAgg,
    // 2. All orders count & total
    allOrdersAgg,
    // 3. Expense aggregates
    expenseAgg,
    // 4. Expenses by category
    expensesByCategory,
    // 5. Orders for daily revenue trend
    ordersForDaily,
    // 6. Expenses for daily trend
    expensesForDaily,
    // 7. Orders for daily count
    ordersForCount,
    // 8. Service breakdown via order items
    serviceGroups,
    // 9. Payment methods
    paymentsByMethod,
    // 10. Top spenders
    topSpenders,
    // 11. Outstanding orders
    outstandingOrders,
    // 12. Delivered orders for turnaround
    deliveredOrders,
    // 13. Inventory
    stockItems,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { ...orderWhere, branchId: { in: branchIds }, status: "DELIVERED" },
      _sum: { totalAmount: true, discountAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...orderWhere, branchId: { in: branchIds } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: expenseWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: { ...orderWhere, branchId: { in: branchIds }, status: "DELIVERED" },
      select: { createdAt: true, totalAmount: true, discountAmount: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      select: { date: true, amount: true },
      orderBy: { date: "asc" },
    }),
    prisma.order.findMany({
      where: { ...orderWhere, branchId: { in: branchIds } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: itemWhere,
      _sum: { subtotal: true },
      _count: true,
      orderBy: { _sum: { subtotal: "desc" } },
      take: 10,
    }),
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: paymentWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { ...orderWhere, branchId: { in: branchIds } },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    prisma.order.findMany({
      where: { paymentStatus: { in: UNPAID_PAYMENT_STATUSES }, branchId: { in: branchIds }, ...orderWhere },
      select: {
        customerId: true,
        customer: { select: { name: true } },
        totalAmount: true,
        paidAmount: true,
        createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: { ...orderWhere, deliveredAt: { not: null }, branchId: { in: branchIds } },
      select: { createdAt: true, deliveredAt: true },
    }),
    prisma.stockItem.findMany({
      where: { branchId: { in: branchIds }, isActive: true },
      select: { currentQuantity: true, lowStockThreshold: true, purchasePricePerUnit: true },
    }),
  ]);

  // --- Compute summary ---
  const revenue = Number(orderAgg._sum.totalAmount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  const netProfit = revenue - expenses;
  const marginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const totalOrders = allOrdersAgg._count;
  const avgOrderValue = totalOrders > 0 ? Number(allOrdersAgg._sum.totalAmount ?? 0) / totalOrders : 0;

  // Outstanding
  let totalOutstanding = 0;
  const outstandingByCustomer = new Map<string, { name: string; balance: number; oldestOrder: string }>();
  for (const o of outstandingOrders) {
    const outstanding = Number(o.totalAmount) - Number(o.paidAmount);
    totalOutstanding += outstanding;
    const existing = outstandingByCustomer.get(o.customerId);
    if (existing) {
      existing.balance += outstanding;
      if (o.createdAt.toISOString() < existing.oldestOrder) existing.oldestOrder = o.createdAt.toISOString();
    } else {
      outstandingByCustomer.set(o.customerId, {
        name: o.customer.name,
        balance: outstanding,
        oldestOrder: o.createdAt.toISOString(),
      });
    }
  }

  // --- Daily breakdown ---
  const dailyMap = new Map<string, { revenue: number; expenses: number; orders: number }>();
  for (const o of ordersForDaily) {
    const day = new Date(o.createdAt).toISOString().slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { revenue: 0, expenses: 0, orders: 0 });
    dailyMap.get(day)!.revenue += Number(o.totalAmount);
  }
  for (const e of expensesForDaily) {
    const day = new Date(e.date).toISOString().slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { revenue: 0, expenses: 0, orders: 0 });
    dailyMap.get(day)!.expenses += Number(e.amount);
  }
  for (const o of ordersForCount) {
    const day = new Date(o.createdAt).toISOString().slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, { revenue: 0, expenses: 0, orders: 0 });
    dailyMap.get(day)!.orders++;
  }
  const dailyBreakdown = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      revenue: d.revenue,
      expenses: d.expenses,
      profit: d.revenue - d.expenses,
      orders: d.orders,
    }));

  // --- Resolve service names ---
  const serviceIds = serviceGroups.map((s) => s.serviceId);
  const services = serviceIds.length > 0
    ? await prisma.service.findMany({ where: { id: { in: serviceIds }, branchId: { in: branchIds } }, select: { id: true, name: true } })
    : [];
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  // --- Resolve category names ---
  const categoryIds = (expensesByCategory.map((c) => c.categoryId).filter(Boolean) as string[]);
  const categories = categoryIds.length > 0
    ? await prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : [];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // --- Resolve top spender names ---
  const spenderIds = topSpenders.map((s) => s.customerId);
  const spenderCustomers = spenderIds.length > 0
    ? await prisma.customer.findMany({ where: { id: { in: spenderIds }, branchId: { in: branchIds } }, select: { id: true, name: true } })
    : [];
  const spenderMap = new Map(spenderCustomers.map((c) => [c.id, c.name]));

  // --- Turnaround ---
  const turnaroundHours = deliveredOrders
    .map((o) => (o.deliveredAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60))
    .filter((h) => h >= 0);
  const turnaroundDistribution = {
    under24h: turnaroundHours.filter((h) => h < 24).length,
    under48h: turnaroundHours.filter((h) => h >= 24 && h < 48).length,
    under72h: turnaroundHours.filter((h) => h >= 48 && h < 72).length,
    over72h: turnaroundHours.filter((h) => h >= 72).length,
  };
  const totalDelivered = turnaroundHours.length;

  // --- Inventory ---
  const totalStockValue = stockItems.reduce((sum, item) => sum + Number(item.currentQuantity) * Number(item.purchasePricePerUnit), 0);
  const lowStockCount = stockItems.filter((item) => Number(item.currentQuantity) <= Number(item.lowStockThreshold)).length;

  // --- Payment method totals ---
  const totalPaymentAmount = paymentsByMethod.reduce((sum, p) => sum + Number(p._sum.amount ?? 0), 0);

  return apiSuccess({
    summary: {
      revenue,
      expenses,
      netProfit,
      marginPercent,
      totalOrders,
      avgOrderValue,
      totalOutstanding,
      affectedCustomers: outstandingByCustomer.size,
    },
    dailyBreakdown,
    topServices: serviceGroups.map((s) => ({
      name: serviceMap.get(s.serviceId) ?? "Unknown",
      orderCount: s._count,
      revenue: Number(s._sum.subtotal ?? 0),
    })),
    expensesByCategory: expensesByCategory
      .sort((a, b) => Number(b._sum.amount ?? 0) - Number(a._sum.amount ?? 0))
      .map((c) => ({
        category: categoryMap.get(c.categoryId!) ?? "Unknown",
        total: Number(c._sum.amount ?? 0),
        share: expenses > 0 ? (Number(c._sum.amount ?? 0) / expenses) * 100 : 0,
      })),
    byPaymentMethod: paymentsByMethod.map((p) => ({
      method: p.paymentMethod,
      count: p._count,
      total: Number(p._sum.amount ?? 0),
      share: totalPaymentAmount > 0 ? (Number(p._sum.amount ?? 0) / totalPaymentAmount) * 100 : 0,
    })),
    topCustomers: topSpenders.map((s) => ({
      name: spenderMap.get(s.customerId) ?? "Unknown",
      totalSpent: Number(s._sum.totalAmount ?? 0),
      orderCount: s._count,
    })),
    outstanding: {
      total: totalOutstanding,
      customersAffected: outstandingByCustomer.size,
      ordersAffected: outstandingOrders.length,
      topBalances: Array.from(outstandingByCustomer.values())
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10),
    },
    turnaround: {
      distribution: turnaroundDistribution,
      totalDelivered,
      under24hPercent: totalDelivered > 0 ? (turnaroundDistribution.under24h / totalDelivered) * 100 : 0,
    },
    inventory: {
      totalItems: stockItems.length,
      totalValue: totalStockValue,
      lowStockCount,
    },
  });
});
