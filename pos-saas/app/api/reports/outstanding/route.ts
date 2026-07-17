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

  const { where } = buildDateFilter(fromStr, toStr);

  const outstandingOrders = await prisma.order.findMany({
    where: {
      paymentStatus: { in: UNPAID_PAYMENT_STATUSES },
      branchId: { in: branchIds },
      ...where,
    },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      paidAmount: true,
      createdAt: true,
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate by customer
  const customerMap = new Map<string, {
    customerId: string;
    name: string;
    phone: string;
    totalOutstanding: number;
    orderCount: number;
    oldestOrder: Date;
    orders: Array<{ orderNumber: string; outstanding: number; createdAt: string }>;
  }>();

  let totalOutstanding = 0;

  for (const o of outstandingOrders) {
    const outstanding = Number(o.totalAmount) - Number(o.paidAmount);
    totalOutstanding += outstanding;

    const existing = customerMap.get(o.customer.id);
    const orderEntry = { orderNumber: o.orderNumber, outstanding, createdAt: o.createdAt.toISOString() };

    if (existing) {
      existing.totalOutstanding += outstanding;
      existing.orderCount++;
      if (o.createdAt < existing.oldestOrder) existing.oldestOrder = o.createdAt;
      existing.orders.push(orderEntry);
    } else {
      customerMap.set(o.customer.id, {
        customerId: o.customer.id,
        name: o.customer.name,
        phone: o.customer.phone ?? "",
        totalOutstanding: outstanding,
        orderCount: 1,
        oldestOrder: o.createdAt,
        orders: [orderEntry],
      });
    }
  }

  const customers = Array.from(customerMap.values())
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    .map((c) => ({
      ...c,
      oldestOrder: c.oldestOrder.toISOString(),
    }));

  return apiSuccess({
    summary: {
      totalOutstanding,
      customersAffected: customers.length,
      ordersAffected: outstandingOrders.length,
    },
    customers,
  });
});
