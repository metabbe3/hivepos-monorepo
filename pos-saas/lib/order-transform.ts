import type { Prisma } from "@/app/generated/prisma/client";

type OrderWithIncludes = Prisma.OrderGetPayload<{
  include: {
    customer: { select: { name: true; phone: true } };
    orderItems: { include: { service: true } };
  };
}>;

type OrderDetailWithIncludes = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    orderItems: { include: { service: true } };
    payments: { orderBy: { createdAt: "desc" } };
  };
}>;

export function transformOrderForRole(order: OrderWithIncludes, canSeeFinancials: boolean) {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
    paidAmount: canSeeFinancials ? Number(order.paidAmount) : 0,
    discountAmount: canSeeFinancials ? Number(order.discountAmount) : 0,
    discountType: canSeeFinancials ? order.discountType : null,
    paymentStatus: canSeeFinancials ? order.paymentStatus : ("PENDING" as const),
    orderItems: order.orderItems.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      weightKg: i.weightKg ? Number(i.weightKg) : null,
      pricePerUnit: Number(i.pricePerUnit),
      subtotal: Number(i.subtotal),
      garmentBreakdown: i.garmentBreakdown as { name: string; qty: number }[] | null,
    })),
  };
}

export function transformOrderDetailForRole(order: OrderDetailWithIncludes, canSeeFinancials: boolean) {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
    paidAmount: canSeeFinancials ? Number(order.paidAmount) : 0,
    discountAmount: canSeeFinancials ? Number(order.discountAmount) : 0,
    discountType: canSeeFinancials ? order.discountType : null,
    paymentStatus: canSeeFinancials ? order.paymentStatus : ("PENDING" as const),
    customer: {
      ...order.customer,
      balance: Number(order.customer.balance),
    },
    orderItems: order.orderItems.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      weightKg: i.weightKg ? Number(i.weightKg) : null,
      pricePerUnit: Number(i.pricePerUnit),
      subtotal: Number(i.subtotal),
      garmentBreakdown: i.garmentBreakdown as { name: string; qty: number }[] | null,
    })),
    payments: canSeeFinancials ? order.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })) : [],
  };
}
