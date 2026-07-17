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

  const { dateFilter, hasFilter } = buildDateFilter(fromStr, toStr);

  // Query 1: Payments made during the selected period for orders created BEFORE the period
  const paymentDateFilter: { gte?: Date; lte?: Date } = {};
  if (hasFilter) {
    if (dateFilter.gte) paymentDateFilter.gte = dateFilter.gte;
    if (dateFilter.lte) paymentDateFilter.lte = dateFilter.lte;
  }

  const orderCreatedBeforeFilter: { lt?: Date } = {};
  if (fromStr) {
    orderCreatedBeforeFilter.lt = new Date(fromStr);
  }

  const [paymentsFromOldOrders, unpaidOrders] = await Promise.all([
    prisma.payment.findMany({
      where: {
        ...(hasFilter ? { createdAt: paymentDateFilter } : {}),
        order: {
          ...(fromStr ? { createdAt: orderCreatedBeforeFilter } : {}),
          branchId: { in: branchIds },
        },
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            customer: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: {
        paymentStatus: { in: UNPAID_PAYMENT_STATUSES },
        branchId: { in: branchIds },
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        paidAmount: true,
        createdAt: true,
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Process payments — group by the order's creation month
  const monthKey = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const paymentMonthMap = new Map<
    string,
    {
      month: string;
      paymentCount: number;
      totalCollected: number;
      orderIds: Set<string>;
      payments: Array<{
        paymentId: string;
        amount: number;
        paymentDate: string;
        orderNumber: string;
        orderId: string;
        customerName: string;
        customerId: string;
        customerPhone: string;
        orderCreatedDate: string;
      }>;
    }
  >();

  for (const payment of paymentsFromOldOrders) {
    const orderMonth = monthKey(payment.order.createdAt);
    let group = paymentMonthMap.get(orderMonth);
    if (!group) {
      group = {
        month: orderMonth,
        paymentCount: 0,
        totalCollected: 0,
        orderIds: new Set(),
        payments: [],
      };
      paymentMonthMap.set(orderMonth, group);
    }

    const amount = Number(payment.amount);
    group.paymentCount++;
    group.totalCollected += amount;
    group.orderIds.add(payment.order.id);
    group.payments.push({
      paymentId: payment.id,
      amount,
      paymentDate: payment.createdAt.toISOString(),
      orderNumber: payment.order.orderNumber,
      orderId: payment.order.id,
      customerName: payment.order.customer.name,
      customerId: payment.order.customer.id,
      customerPhone: payment.order.customer.phone ?? "",
      orderCreatedDate: payment.order.createdAt.toISOString(),
    });
  }

  const paymentsCollectedByMonth = Array.from(paymentMonthMap.values())
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((g) => ({
      month: g.month,
      paymentCount: g.paymentCount,
      totalCollected: g.totalCollected,
      orderCount: g.orderIds.size,
      payments: g.payments,
    }));

  // Process unpaid orders — group by creation month (only months with outstanding)
  const unpaidMonthMap = new Map<
    string,
    {
      month: string;
      count: number;
      totalOutstanding: number;
      orders: Array<{
        orderId: string;
        orderNumber: string;
        totalAmount: number;
        paidAmount: number;
        outstanding: number;
        createdAt: string;
        customerName: string;
        customerId: string;
        customerPhone: string;
      }>;
    }
  >();

  for (const order of unpaidOrders) {
    const outstanding = Number(order.totalAmount) - Number(order.paidAmount);
    const orderMonth = monthKey(order.createdAt);

    let group = unpaidMonthMap.get(orderMonth);
    if (!group) {
      group = { month: orderMonth, count: 0, totalOutstanding: 0, orders: [] };
      unpaidMonthMap.set(orderMonth, group);
    }

    group.count++;
    group.totalOutstanding += outstanding;
    group.orders.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: Number(order.totalAmount),
      paidAmount: Number(order.paidAmount),
      outstanding,
      createdAt: order.createdAt.toISOString(),
      customerName: order.customer.name,
      customerId: order.customer.id,
      customerPhone: order.customer.phone ?? "",
    });
  }

  const unpaidByMonth = Array.from(unpaidMonthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  // Calculate summary
  const totalCollected = paymentsCollectedByMonth.reduce((sum, m) => sum + m.totalCollected, 0);
  const totalUnpaidOrders = unpaidByMonth.reduce((sum, m) => sum + m.count, 0);
  const totalOutstanding = unpaidByMonth.reduce((sum, m) => sum + m.totalOutstanding, 0);
  const oldestUnpaid =
    unpaidOrders.length > 0
      ? unpaidOrders.reduce((oldest, o) => (o.createdAt < oldest.createdAt ? o : oldest)).createdAt.toISOString()
      : null;

  return apiSuccess({
    summary: { totalCollected, totalUnpaidOrders, totalOutstanding, oldestUnpaid },
    paymentsCollectedByMonth,
    unpaidByMonth,
  });
});
