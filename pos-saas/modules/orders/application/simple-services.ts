import { NotFoundError } from "@/modules/shared";
import { wibDateBounds } from "@/lib/dates";
import type { OrderRepository, ListOrdersQuery } from "../domain/repository.port";
import type { RequestContext } from "./context";
import {
  type UpdateNotesInput,
  type ListOrdersInput,
  type OrderListDTO,
} from "./dto";
import type { OrderStatus, PaymentStatus, BusinessModule } from "../domain/types";
import { maskOrderForRole, maskOrderDetailForRole } from "./role-transform";

// ── Update notes (PATCH) ────────────────────────────────────────────────

export class UpdateNotesService {
  constructor(private orderRepo: OrderRepository) {}

  async execute(orderId: string, input: UpdateNotesInput, ctx: RequestContext) {
    const existing = await this.orderRepo.findById(orderId, ctx.branchId);
    if (!existing) {
      throw new NotFoundError("Order", orderId);
    }

    const updated = await this.orderRepo.updateNotes(
      orderId,
      ctx.branchId,
      input.notes ?? null,
    );

    return maskOrderForRole(updated, ctx);
  }
}

// ── Get single order (GET /:id) ─────────────────────────────────────────

export class GetOrderService {
  constructor(private orderRepo: OrderRepository) {}

  async execute(orderId: string, ctx: RequestContext) {
    const order = await this.orderRepo.findDetailById(orderId, ctx.branchId);
    if (!order) {
      throw new NotFoundError("Order", orderId);
    }

    return maskOrderDetailForRole(order, ctx);
  }
}

// ── List orders (GET /) ─────────────────────────────────────────────────

export class ListOrdersService {
  constructor(private orderRepo: OrderRepository) {}

  async execute(input: ListOrdersInput, ctx: RequestContext): Promise<OrderListDTO> {
    const page = Math.max(1, parseInt(input.page ?? "1", 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(input.limit ?? "20", 10) || 20));

    const validStatuses: OrderStatus[] = [
      "RECEIVED",
      "IN_PROGRESS",
      "READY",
      "DELIVERED",
    ];
    const status: OrderStatus | undefined =
      input.status && input.status !== "ALL" && validStatuses.includes(input.status as OrderStatus)
        ? (input.status as OrderStatus)
        : undefined;

    const validPaymentStatuses: PaymentStatus[] = ["PENDING", "PARTIAL", "PAID"];
    const paymentStatus: PaymentStatus | undefined =
      input.paymentStatus && validPaymentStatuses.includes(input.paymentStatus)
        ? input.paymentStatus
        : undefined;

    const sortBy = (input.sortBy ?? "createdAt") as ListOrdersQuery["sortBy"];
    const sortOrder = (input.sortOrder ?? "desc") as ListOrdersQuery["sortOrder"];

    // Date range filter — interpret YYYY-MM-DD as WIB (UTC+7) calendar days so
    // "this month"/"today" match the Indonesian business day, not a UTC-shifted one.
    const dateBounds = wibDateBounds({ from: input.dateFrom, to: input.dateTo });

    const query: ListOrdersQuery = {
      branchIds: ctx.branchIds,
      module: ctx.activeModule as BusinessModule,
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(input.search ? { search: input.search } : {}),
      ...(dateBounds.gte || dateBounds.lte
        ? { dateFrom: dateBounds.gte, dateTo: dateBounds.lte }
        : {}),
      sortBy,
      sortOrder,
      page,
      limit,
    };

    const { orders, total } = await this.orderRepo.list(query);

    return {
      orders: orders.map((o) => maskOrderForRole(o, ctx)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

// ── Delete order (DELETE /:id) ──────────────────────────────────────────

export class DeleteOrderService {
  constructor(private orderRepo: OrderRepository) {}

  async execute(orderId: string, ctx: RequestContext): Promise<void> {
    // Repository's delete handles deposit refund transactionally.
    // We validate existence first for a clean 404.
    const existing = await this.orderRepo.findById(orderId, ctx.branchId);
    if (!existing) {
      throw new NotFoundError("Order", orderId);
    }

    await this.orderRepo.delete(orderId, ctx.branchId);
  }
}
