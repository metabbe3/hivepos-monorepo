import {
  NotFoundError,
  BusinessRuleError,
} from "@/modules/shared";
import type {
  OrderRepository,
  ReplaceOrderData,
} from "../domain/repository.port";
import { priceOrder } from "../domain/pricing";
import { orderNumberPrefix } from "../domain/order-number.vo";
import { deriveTenantCode } from "@/lib/tenant-code";
import { allocateOrderNumber } from "./allocate-order-number";
import type { ServiceCatalogPort, TenantPort } from "./ports";
import type { RequestContext } from "./context";
import type { UpdateOrderInput } from "./dto";

export class UpdateOrderService {
  constructor(
    private orderRepo: OrderRepository,
    private serviceCatalog: ServiceCatalogPort,
    private tenantPort: TenantPort,
  ) {}

  async execute(
    orderId: string,
    input: UpdateOrderInput,
    ctx: RequestContext,
  ) {
    // ── 1. Load existing order with payments ──
    const existing = await this.orderRepo.findDetailById(orderId, ctx.branchId);
    if (!existing) {
      throw new NotFoundError("Order", orderId);
    }

    // ── 2. Guard: delivered orders are immutable ──
    if (existing.status === "DELIVERED") {
      throw new BusinessRuleError("Cannot edit delivered orders");
    }

    // ── 3. Guard: can't change customer when deposit payments exist ──
    const hasDepositPayments = existing.payments.some(
      (p) => p.paymentMethod === "DEPOSIT",
    );
    if (hasDepositPayments && input.customerId !== existing.customerId) {
      throw new BusinessRuleError(
        "Cannot change customer: order has deposit payments",
      );
    }

    // ── 4. Fetch services and validate ──
    const serviceIds = input.items.map((i) => i.serviceId);
    const services = await this.serviceCatalog.findPricingForServices(
      serviceIds,
      ctx.branchIds,
    );
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const missing = serviceIds.filter((id) => !serviceMap.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(`Services not found: ${missing.join(", ")}`);
    }

    // ── 5. Recalculate pricing ──
    const pricing = priceOrder(
      input.items,
      serviceMap,
      input.discountType,
      input.discountAmount,
    );

    // ── 6. Regenerate order number if receivedAt changed ──
    const newReceivedAt = input.receivedAt ? new Date(input.receivedAt) : null;
    let newPrefix: string | null = null;
    let renumberReceivedAt: Date | null = null;
    let renumberTenantCode: string | null = null;

    if (newReceivedAt) {
      // ponytail: load tenant slug once for both old/new prefix compare.
      const tenantSlug = await this.tenantPort.getSlug(ctx.tenantId);
      const tenantCode = deriveTenantCode(tenantSlug ?? "ord");
      const oldDateStr = existing.receivedAt
        ? orderNumberPrefix(existing.receivedAt, tenantCode)
        : "";
      const candidatePrefix = orderNumberPrefix(newReceivedAt, tenantCode);

      if (candidatePrefix !== oldDateStr) {
        // ponytail: delegate the renumber through allocateOrderNumber so a
        // concurrent create can't trip P2002 on the new number. The actual
        // replaceItems call happens inside the helper's tryInsert callback.
        newPrefix = candidatePrefix;
        renumberReceivedAt = newReceivedAt;
        renumberTenantCode = tenantCode;
      }
    }

    // ── 7. Persist (repository handles item replacement + payment recalc) ──
    const data: Omit<ReplaceOrderData, "orderNumber"> = {
      customerId: input.customerId,
      totalAmount: pricing.totalAmount.amount,
      discountAmount: pricing.discount.amount,
      discountType: input.discountType ?? null,
      notes: input.notes ?? null,
      receivedAt: newReceivedAt,
      items: pricing.items,
    };

    if (newPrefix && renumberReceivedAt && renumberTenantCode) {
      return allocateOrderNumber(
        newPrefix,
        renumberReceivedAt,
        renumberTenantCode,
        (p) => this.orderRepo.getLastSequenceForPrefix(p),
        (orderNumber) =>
          this.orderRepo.replaceItems(orderId, ctx.branchId, {
            ...data,
            orderNumber,
          }),
      );
    }

    return this.orderRepo.replaceItems(orderId, ctx.branchId, data);
  }
}
