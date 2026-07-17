import {
  NotFoundError,
  ForbiddenError,
  OutletLockedError,
  SubscriptionLimitReachedError,
  type FieldError,
} from "@/modules/shared";
import type { OrderRepository, CreateOrderData } from "../domain/repository.port";
import { priceOrder } from "../domain/pricing";
import { orderNumberPrefix } from "../domain/order-number.vo";
import { allocateOrderNumber } from "./allocate-order-number";
import { deriveTenantCode } from "@/lib/tenant-code";
import type { ServiceCatalogPort, BranchPort, OrderLimitPort, TenantPort, CustomerLookupPort } from "./ports";
import type { RequestContext } from "./context";
import { hasPermission } from "./context";
import type { CreateOrderInput } from "./dto";
import type { BusinessModule } from "../domain/types";

export class CreateOrderService {
  constructor(
    private orderRepo: OrderRepository,
    private serviceCatalog: ServiceCatalogPort,
    private branchPort: BranchPort,
    private limitPort: OrderLimitPort,
    private tenantPort: TenantPort,
    private customerLookup: CustomerLookupPort,
  ) {}

  async execute(
    input: CreateOrderInput,
    ctx: RequestContext,
  ): Promise<ReturnType<OrderRepository["create"]>> {
    // ── 1. Guard: outlet must have active coverage ──
    const branch = await this.branchPort.getCoverage(ctx.branchId);
    if (branch && !branch.isFreeTier) {
      const now = new Date();
      if (!branch.coverageEnd || branch.coverageEnd <= now) {
        throw new OutletLockedError();
      }
    }

    // ── 2. Guard: free-tier order limit ──
    const limitCheck = await this.limitPort.checkOrderLimit(ctx.tenantId);
    if (!limitCheck.allowed) {
      const details: FieldError[] = [
        {
          field: "limit",
          message: `Order limit: ${limitCheck.current}/${limitCheck.max} this month`,
        },
      ];
      throw new SubscriptionLimitReachedError(
        limitCheck.reason ?? "Monthly order limit reached",
        details,
      );
    }

    // ── 3. Guard: discount requires permission ──
    if (
      (input.discountType || input.discountAmount) &&
      !hasPermission(ctx, "orders", "discount")
    ) {
      throw new ForbiddenError("You do not have permission to apply discounts");
    }

    // ── 3b. Guard: PERCENTAGE discount must be 0-100 ──
    // ponytail: FIXED discount is already capped at subtotal by pricing.ts
    // (Money.min(subtotal)). PERCENTAGE has no natural cap there, so we
    // enforce the business range here. Allows 100% (comp / free orders).
    if (
      input.discountType === "PERCENTAGE" &&
      input.discountAmount !== undefined &&
      (input.discountAmount < 0 || input.discountAmount > 100)
    ) {
      throw new ForbiddenError(
        "Diskon persen harus di antara 0 dan 100.",
      );
    }

    // ── 3c. Guard: customerId must belong to the caller's branch ──
    // ponytail: closes the cross-tenant spoofing gap — without this, a
    // tampered offline payload could point at another tenant's customer and
    // Prisma's FK check only validates existence, not tenant scope.
    const customerBelongsToBranch = await this.customerLookup.existsInBranch(
      input.customerId,
      ctx.branchId,
    );
    if (!customerBelongsToBranch) {
      throw new NotFoundError("Customer not found");
    }

    // ── 4. Fetch service pricing and validate all exist ──
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

    // ── 5. Derive the order's module from the first line item ──
    const orderModule: BusinessModule =
      services[0]?.module ?? ctx.activeModule;

    // ── 6. Calculate pricing (pure domain function) ──
    const pricing = priceOrder(
      input.items,
      serviceMap,
      input.discountType,
      input.discountAmount,
    );

    // ── 7+8. Generate order number + persist ──
    // ponytail: tenant code from slug → order numbers self-identify their
    // tenant (HBL-20260621-0001). Fallback "ORD" if slug lookup misses.
    // allocateOrderNumber retries on P2002 so two concurrent calls (manual
    // create + pickup-confirm) don't collide on the same sequence number.
    const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
    const tenantSlug = await this.tenantPort.getSlug(ctx.tenantId);
    const tenantCode = deriveTenantCode(tenantSlug ?? "ord");
    const prefix = orderNumberPrefix(receivedAt, tenantCode);

    const buildCreateData = (orderNumber: string): CreateOrderData => ({
      branchId: ctx.branchId,
      tenantId: ctx.tenantId,
      module: orderModule,
      orderNumber,
      customerId: input.customerId,
      totalAmount: pricing.totalAmount.amount,
      discountAmount: pricing.discount.amount,
      discountType: input.discountType ?? null,
      receivedAt,
      notes: input.notes ?? null,
      items: pricing.items,
      clientId: input.clientId,
    });

    return allocateOrderNumber(
      prefix,
      receivedAt,
      tenantCode,
      (p) => this.orderRepo.getLastSequenceForPrefix(p),
      (orderNumber) => this.orderRepo.create(buildCreateData(orderNumber)),
    );
  }
}
