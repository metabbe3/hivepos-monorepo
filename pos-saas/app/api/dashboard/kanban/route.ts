import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";

export const GET = withErrorHandler(async () => {
  const ctx = await requireWithBranchOrThrow("dashboard", "read");
  const { branchIds, activeModule: moduleFilter } = ctx;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      branchId: { in: branchIds },
      module: moduleFilter,
      OR: [
        { status: { in: ["RECEIVED", "IN_PROGRESS", "READY"] } },
        { status: "DELIVERED", deliveredAt: { gte: yesterday } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, phone: true } },
      orderItems: {
        select: {
          service: { select: { name: true } },
          quantity: true,
          weightKg: true,
          subtotal: true,
        },
      },
    },
  });

  const result = orders.map((o) => {
    const isExpress = o.orderItems.some((item) =>
      /express/i.test(item.service.name)
    );

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer.name,
      customerPhone: o.customer.phone,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalAmount: Number(o.totalAmount),
      paidAmount: Number(o.paidAmount),
      isExpress,
      items: o.orderItems.map((item) => ({
        serviceName: item.service.name,
        quantity: Number(item.quantity),
        weightKg: item.weightKg ? Number(item.weightKg) : null,
      })),
      createdAt: o.createdAt.toISOString(),
      receivedAt: o.receivedAt?.toISOString() ?? null,
      inProgressAt: o.inProgressAt?.toISOString() ?? null,
      readyAt: o.readyAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
    };
  });

  return apiSuccess(result);
});
