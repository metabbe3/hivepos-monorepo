import { prisma } from "@/lib/prisma";
import type {
  CustomerRepository,
  CustomerRecord,
  CustomerDetailRecord,
  CustomerWithSummary,
  CreateCustomerData,
  UpdateCustomerData,
  ListCustomersQuery,
} from "../domain/repository.port";
import type { CustomerStatus } from "../domain/types";
import { deriveCustomerStatus } from "../domain/customer-status";
import { decimalToNumberRequired } from "@/modules/shared/serialization";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function toCustomerRecord(row: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  balance: { toNumber: () => number };
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    balance: decimalToNumberRequired(row.balance),
    branchId: row.branchId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaCustomerRepository implements CustomerRepository {
  async findMany(query: ListCustomersQuery): Promise<CustomerWithSummary[]> {
    const customers = await prisma.customer.findMany({
      where: {
        branchId: query.branchId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search } },
                { phone: { contains: query.search } },
              ],
            }
          : {}),
      },
    });

    // Aggregate per-customer order stats in ONE groupBy instead of loading
    // every order row via include (avoids N+1 / over-fetch on large tenants).
    const customerIds = customers.map((c) => c.id);
    const stats =
      customerIds.length > 0
        ? await prisma.order.groupBy({
            by: ["customerId"],
            where: { branchId: query.branchId, customerId: { in: customerIds } },
            _count: true,
            _sum: { totalAmount: true },
            _max: { createdAt: true },
          })
        : [];
    const statsMap = new Map(stats.map((s) => [s.customerId, s]));

    const now = Date.now();

    const enriched: CustomerWithSummary[] = customers.map((c) => {
      const s = statsMap.get(c.id);
      const totalOrders = s?._count ?? 0;
      const totalSpent = s?._sum?.totalAmount
        ? decimalToNumberRequired(s._sum.totalAmount)
        : 0;
      const lastOrderDate = s?._max?.createdAt ?? null;

      const customerStatus: CustomerStatus = deriveCustomerStatus(
        c.createdAt,
        lastOrderDate,
        totalOrders,
        now,
      );

      return {
        ...toCustomerRecord(c),
        totalOrders,
        totalSpent,
        lastOrderDate,
        customerStatus,
      };
    });

    // Sort
    const sort = query.sort || "createdAt";
    const dir = query.order === "asc" ? 1 : -1;

    enriched.sort((a, b) => {
      switch (sort) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "orderCount":
          return dir * (a.totalOrders - b.totalOrders);
        case "totalSpent":
          return dir * (a.totalSpent - b.totalSpent);
        case "lastOrderDate":
          if (!a.lastOrderDate && !b.lastOrderDate) return 0;
          if (!a.lastOrderDate) return dir * 1;
          if (!b.lastOrderDate) return dir * -1;
          return dir * (a.lastOrderDate.getTime() - b.lastOrderDate.getTime());
        default:
          return dir * (a.createdAt.getTime() - b.createdAt.getTime());
      }
    });

    return enriched;
  }

  async findById(id: string, branchId: string): Promise<CustomerDetailRecord | null> {
    const customer = await prisma.customer.findUnique({
      where: { id, branchId },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            orderItems: { select: { id: true } },
            payments: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });

    if (!customer) return null;

    return {
      ...toCustomerRecord(customer),
      orders: customer.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: decimalToNumberRequired(o.totalAmount),
        paidAmount: decimalToNumberRequired(o.paidAmount),
        createdAt: o.createdAt,
        orderItems: o.orderItems.map((oi) => ({ id: oi.id })),
        payments: o.payments.map((p) => ({
          id: p.id,
          amount: decimalToNumberRequired(p.amount),
          paymentMethod: p.paymentMethod,
          createdAt: p.createdAt,
        })),
      })),
    };
  }

  async create(data: CreateCustomerData): Promise<CustomerRecord> {
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        notes: data.notes,
        branchId: data.branchId,
        clientId: data.clientId,
      },
    });
    return toCustomerRecord(customer);
  }

  async update(id: string, branchId: string, data: UpdateCustomerData): Promise<CustomerRecord> {
    const customer = await prisma.customer.update({
      where: { id, branchId },
      data,
    });
    return toCustomerRecord(customer);
  }

  async delete(id: string, branchId: string): Promise<void> {
    await prisma.customer.delete({ where: { id, branchId } });
  }

  async findByPhone(phone: string, branchId: string): Promise<CustomerRecord | null> {
    const customer = await prisma.customer.findFirst({
      where: { phone, branchId },
    });
    return customer ? toCustomerRecord(customer) : null;
  }

  async findByClientId(clientId: string): Promise<CustomerRecord | null> {
    const customer = await prisma.customer.findFirst({
      where: { clientId },
    });
    return customer ? toCustomerRecord(customer) : null;
  }

  async countOrders(customerId: string, branchId: string): Promise<number> {
    return prisma.order.count({ where: { customerId, branchId } });
  }
}
