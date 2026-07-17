import { prisma } from "@/lib/prisma";
import { logger } from "@/modules/shared";
import {
  decimalToNumber,
  decimalToNumberRequired,
} from "@/modules/shared/serialization";
import type { Prisma } from "@/app/generated/prisma/client";
import type {
  OrderRepository,
  OrderRecord,
  OrderDetailRecord,
  CreateOrderData,
  ReplaceOrderData,
  ListOrdersQuery,
} from "../domain/repository.port";
import type { OrderStatus } from "../domain/types";
import { STATUS_TIMESTAMP } from "../domain/status-flow";
import { derivePaymentStatus } from "../domain/payment-status";
import { orderNumberPrefix, parseSequence } from "../domain/order-number.vo";

/** Convert a raw Prisma order row (list view) to the domain record. */
function toOrderRecord(row: {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  module: string;
  totalAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  discountType: string | null;
  paymentStatus: string;
  notes: string | null;
  receivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { name: string; phone: string | null };
}): OrderRecord {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    customerName: row.customer.name,
    customerPhone: row.customer.phone,
    status: row.status,
    module: row.module as OrderRecord["module"],
    totalAmount: decimalToNumberRequired(row.totalAmount),
    paidAmount: decimalToNumberRequired(row.paidAmount),
    discountAmount: decimalToNumberRequired(row.discountAmount),
    discountType: row.discountType,
    paymentStatus: row.paymentStatus as OrderRecord["paymentStatus"],
    notes: row.notes,
    receivedAt: row.receivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Read settings.website.qrisImageUrl from the untyped Tenant.settings JSON. */
function readQrisUrl(settings: unknown): string | null {
  const s = settings as { website?: { qrisImageUrl?: string } } | null | undefined;
  return s?.website?.qrisImageUrl ?? null;
}

/** Convert a raw Prisma order row (detail view) to the domain record. */
function toOrderDetailRecord(row: {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  module: string;
  totalAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  discountType: string | null;
  paymentStatus: string;
  notes: string | null;
  receivedAt: Date | null;
  inProgressAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: string; name: string; phone: string | null; balance: Prisma.Decimal };
  orderItems: Array<{
    id: string;
    serviceId: string;
    quantity: Prisma.Decimal;
    weightKg: Prisma.Decimal | null;
    pricePerUnit: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    notes: string | null;
    garmentBreakdown: unknown;
    service: { id: string; name: string };
  }>;
  payments: Array<{
    id: string;
    amount: Prisma.Decimal;
    paymentMethod: string;
    notes: string | null;
    paidAt: Date;
  }>;
  branch: {
    invoiceFooter: string | null;
    printerPaperSize: string | null;
    tenant: { settings: unknown };
  };
}): OrderDetailRecord {
  return {
    ...toOrderRecord(row),
    inProgressAt: row.inProgressAt,
    readyAt: row.readyAt,
    deliveredAt: row.deliveredAt,
    customerBalance: decimalToNumberRequired(row.customer.balance),
    qrisUrl: readQrisUrl(row.branch.tenant.settings),
    invoiceFooter: row.branch.invoiceFooter,
    printerPaperSize: row.branch.printerPaperSize,
    orderItems: row.orderItems.map((i) => ({
      id: i.id,
      serviceId: i.serviceId,
      serviceName: i.service.name,
      quantity: decimalToNumberRequired(i.quantity),
      weightKg: decimalToNumber(i.weightKg),
      pricePerUnit: decimalToNumberRequired(i.pricePerUnit),
      subtotal: decimalToNumberRequired(i.subtotal),
      notes: i.notes,
      garmentBreakdown: i.garmentBreakdown as Array<{ name: string; qty: number }> | null,
    })),
    payments: row.payments.map((p) => ({
      id: p.id,
      amount: decimalToNumberRequired(p.amount),
      paymentMethod: p.paymentMethod as OrderDetailRecord["payments"][number]["paymentMethod"],
      notes: p.notes,
      paidAt: p.paidAt,
    })),
  };
}

const detailInclude = {
  customer: { select: { id: true, name: true, phone: true, balance: true } },
  orderItems: { include: { service: { select: { id: true, name: true } } } },
  payments: { orderBy: { createdAt: "desc" as const } },
  // branch.invoiceFooter + tenant.settings.website.qrisImageUrl feed the
  // WhatsApp receipt's {{terms}} / {{qrisLine}} blocks; branch.printerPaperSize
  // drives the receipt page's thermal-paper width (read off the order itself).
  branch: {
    select: {
      invoiceFooter: true,
      printerPaperSize: true,
      tenant: { select: { settings: true } },
    },
  },
} satisfies Prisma.OrderInclude;

export class PrismaOrderRepository implements OrderRepository {
  async findById(id: string, branchId: string): Promise<OrderRecord | null> {
    const row = await prisma.order.findUnique({
      where: { id, branchId },
      include: {
        customer: { select: { name: true, phone: true } },
        orderItems: { include: { service: true } },
      },
    });
    return row ? toOrderRecord(row) : null;
  }

  async findDetailById(
    id: string,
    branchId: string,
  ): Promise<OrderDetailRecord | null> {
    const row = await prisma.order.findUnique({
      where: { id, branchId },
      include: detailInclude,
    });
    return row ? toOrderDetailRecord(row) : null;
  }

  async list(query: ListOrdersQuery): Promise<{ orders: OrderRecord[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      branchId: { in: query.branchIds },
      ...(query.module ? { module: query.module } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            AND: [
              {
                OR: [
                  { receivedAt: buildDateFilter(query) },
                  { receivedAt: null, createdAt: buildDateFilter(query) },
                ],
              },
            ],
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search } },
              { customer: { name: { contains: query.search } } },
              { customer: { phone: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.OrderOrderByWithRelationInput =
      query.sortBy === "totalAmount"
        ? { totalAmount: query.sortOrder ?? "desc" }
        : query.sortBy === "customerName"
          ? { customer: { name: query.sortOrder ?? "desc" } }
          : query.sortBy === "receivedAt"
            ? { receivedAt: { sort: query.sortOrder ?? "desc", nulls: "last" } }
            : { createdAt: query.sortOrder ?? "desc" };

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { name: true, phone: true } },
          orderItems: { include: { service: true } },
        },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { orders: rows.map(toOrderRecord), total };
  }

  async create(data: CreateOrderData): Promise<OrderRecord> {
    const row = await prisma.order.create({
      data: {
        branchId: data.branchId,
        module: data.module,
        orderNumber: data.orderNumber,
        customerId: data.customerId,
        totalAmount: data.totalAmount,
        discountAmount: data.discountAmount,
        discountType: data.discountType,
        receivedAt: data.receivedAt,
        notes: data.notes,
        clientId: data.clientId,
        orderItems: {
          create: data.items.map((item) => ({
            serviceId: item.serviceId,
            quantity: item.quantity,
            weightKg: item.weightKg,
            pricePerUnit: item.pricePerUnit,
            subtotal: item.subtotal,
            notes: item.notes,
            garmentBreakdown: item.garmentBreakdown ?? undefined,
          })),
        },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        orderItems: { include: { service: true } },
      },
    });

    logger.info({ orderId: row.id, orderNumber: row.orderNumber }, "Order created");
    return toOrderRecord(row);
  }

  async updateNotes(
    id: string,
    branchId: string,
    notes: string | null,
  ): Promise<OrderRecord> {
    const row = await prisma.order.update({
      where: { id, branchId },
      data: { notes },
      include: {
        customer: { select: { name: true, phone: true } },
        orderItems: { include: { service: true } },
      },
    });
    return toOrderRecord(row);
  }

  async replaceItems(
    id: string,
    branchId: string,
    data: ReplaceOrderData,
  ): Promise<OrderDetailRecord> {
    const result = await prisma.$transaction(async (tx) => {
      // Delete old items
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      // Update order with new items
      await tx.order.update({
        where: { id, branchId },
        data: {
          customerId: data.customerId,
          totalAmount: data.totalAmount,
          discountAmount: data.discountAmount,
          discountType: data.discountType,
          notes: data.notes,
          ...(data.receivedAt ? { receivedAt: data.receivedAt } : {}),
          ...(data.orderNumber ? { orderNumber: data.orderNumber } : {}),
          orderItems: {
            create: data.items.map((item) => ({
              serviceId: item.serviceId,
              quantity: item.quantity,
              weightKg: item.weightKg,
              pricePerUnit: item.pricePerUnit,
              subtotal: item.subtotal,
              notes: item.notes,
              garmentBreakdown: item.garmentBreakdown ?? undefined,
            })),
          },
        },
      });

      // Recalculate payment status from the new total
      const updated = await tx.order.findUniqueOrThrow({ where: { id } });
      const paymentStatus = derivePaymentStatus(
        decimalToNumberRequired(updated.paidAmount),
        decimalToNumberRequired(updated.totalAmount),
      );

      await tx.order.update({
        where: { id },
        data: { paymentStatus },
      });

      return tx.order.findUnique({
        where: { id },
        include: detailInclude,
      });
    });

    if (!result) {
      throw new Error(`Order ${id} not found after update`);
    }

    return toOrderDetailRecord(result);
  }

  async delete(id: string, branchId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id, branchId },
        include: { payments: true, customer: true },
      });

      if (!existing) return;

      // Refund deposit payments if any were used
      const depositPaid = existing.payments
        .filter((p) => p.paymentMethod === "DEPOSIT")
        .reduce((sum, p) => sum + decimalToNumberRequired(p.amount), 0);

      if (depositPaid > 0) {
        const newBalance = decimalToNumberRequired(existing.customer.balance) + depositPaid;
        await tx.depositTransaction.create({
          data: {
            customerId: existing.customerId,
            type: "REFUND",
            amount: depositPaid,
            balanceAfter: newBalance,
            description: `Order deleted refund — ${existing.orderNumber}`,
            orderId: id,
            branchId,
          },
        });
        await tx.customer.update({
          where: { id: existing.customerId },
          data: { balance: newBalance },
        });
      }

      await tx.payment.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id, branchId } });
    });
  }

  async advanceStatus(
    id: string,
    branchId: string,
    status: OrderStatus,
  ): Promise<OrderRecord> {
    const timestampField = STATUS_TIMESTAMP[status];

    const row = await prisma.order.update({
      where: { id, branchId },
      data: {
        status,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
      include: {
        customer: { select: { name: true, phone: true } },
        orderItems: { include: { service: true } },
      },
    });

    return toOrderRecord(row);
  }

  async getLastSequenceForPrefix(prefix: string): Promise<number> {
    const last = await prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });

    return last ? parseSequence(last.orderNumber) : 0;
  }

  async findByClientId(clientId: string): Promise<OrderRecord | null> {
    const row = await prisma.order.findUnique({
      where: { clientId },
      include: {
        customer: { select: { name: true, phone: true } },
        orderItems: { include: { service: true } },
      },
    });
    return row ? toOrderRecord(row) : null;
  }
}

function buildDateFilter(query: ListOrdersQuery): Prisma.DateTimeFilter {
  const filter: Prisma.DateTimeFilter = {};
  if (query.dateFrom) filter.gte = query.dateFrom;
  if (query.dateTo) filter.lte = query.dateTo;
  return filter;
}
