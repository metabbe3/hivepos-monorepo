import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { UNPAID_PAYMENT_STATUSES } from "@/lib/constants";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { buildDateFilter } from "@/lib/format";
import { wibDateBounds } from "@/lib/dates";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "read");
  const { branchIds } = ctx;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const { where } = buildDateFilter(fromStr, toStr);

  // Customer model doesn't have receivedAt — use createdAt directly (WIB bounds)
  const customerBounds = wibDateBounds({ from: fromStr, to: toStr });
  const customerDateFilter: Record<string, unknown> = {};
  if (customerBounds.gte) customerDateFilter.createdAt = { gte: customerBounds.gte };
  if (customerBounds.lte) customerDateFilter.createdAt = { ...(customerDateFilter.createdAt as object), lte: customerBounds.lte };
  const customerWhere = Object.keys(customerDateFilter).length > 0 ? customerDateFilter : {};

  const fromDate = fromStr ? new Date(fromStr) : new Date(0);

  const [newCustomersCount, totalCustomers, topSpenders, firstOrderPerCustomer, outstandingOrders] = await Promise.all([
    // New customers in period (uses Customer.createdAt, not Order.receivedAt)
    prisma.customer.count({ where: { ...customerWhere, branchId: { in: branchIds } } }),
    // Total customers
    prisma.customer.count({ where: { branchId: { in: branchIds } } }),
    // Top spenders in period
    prisma.order.groupBy({
      by: ["customerId"],
      where: { ...where, branchId: { in: branchIds } },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 20,
    }),
    // First order per customer (for new vs returning)
    prisma.order.groupBy({
      by: ["customerId"],
      _min: { createdAt: true },
      where: { branchId: { in: branchIds } },
    }),
    // Outstanding balances
    prisma.order.findMany({
      where: { paymentStatus: { in: UNPAID_PAYMENT_STATUSES }, branchId: { in: branchIds } },
      select: {
        customerId: true,
        customer: { select: { name: true, phone: true } },
        totalAmount: true,
        paidAmount: true,
      },
    }),
  ]);

  // Resolve top spender names
  const spenderIds = topSpenders.map((s) => s.customerId);
  const spenderCustomers = spenderIds.length > 0
    ? await prisma.customer.findMany({ where: { id: { in: spenderIds }, branchId: { in: branchIds } }, select: { id: true, name: true } })
    : [];
  const spenderMap = new Map(spenderCustomers.map((c) => [c.id, c.name]));

  // New vs returning
  const firstOrderMap = new Map(firstOrderPerCustomer.map((f) => [f.customerId, f._min.createdAt]));
  let newCount = 0;
  let returningCount = 0;
  const uniqueCustomerIds = new Set(topSpenders.map((s) => s.customerId));
  for (const id of uniqueCustomerIds) {
    const firstDate = firstOrderMap.get(id);
    if (firstDate && firstDate >= fromDate) newCount++;
    else returningCount++;
  }

  // Aggregate outstanding by customer
  const outstandingMap = new Map<string, { name: string; phone: string; totalOutstanding: number; orderCount: number }>();
  for (const o of outstandingOrders) {
    const existing = outstandingMap.get(o.customerId);
    const outstanding = Number(o.totalAmount) - Number(o.paidAmount);
    if (existing) {
      existing.totalOutstanding += outstanding;
      existing.orderCount++;
    } else {
      outstandingMap.set(o.customerId, {
        name: o.customer.name,
        phone: o.customer.phone ?? "",
        totalOutstanding: outstanding,
        orderCount: 1,
      });
    }
  }

  const totalSpent = topSpenders.reduce((sum, s) => sum + Number(s._sum.totalAmount ?? 0), 0);

  return apiSuccess({
    summary: {
      totalCustomers,
      newCustomers: newCustomersCount,
      newInPeriod: newCount,
      returningInPeriod: returningCount,
      avgSpendPerCustomer: uniqueCustomerIds.size > 0 ? Math.round(totalSpent / uniqueCustomerIds.size) : 0,
    },
    topSpenders: topSpenders.map((s) => ({
      customerId: s.customerId,
      name: spenderMap.get(s.customerId) ?? "Unknown",
      orders: s._count,
      totalSpent: Number(s._sum.totalAmount ?? 0),
    })),
    outstandingBalance: Array.from(outstandingMap.entries())
      .map(([id, data]) => ({ customerId: id, ...data }))
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 20),
  });
});
