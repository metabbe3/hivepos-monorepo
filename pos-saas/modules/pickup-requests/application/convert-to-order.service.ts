import { NotFoundError, ConflictError } from "@/modules/shared";
import type {
  PickupRequestRepository,
  CustomerPort,
} from "../domain/repository.port";
import { assertCanTransition } from "../domain/status-flow";
import type { RequestContext } from "./context";
import type { BranchRequestContext } from "@/modules/shared/application/context";

/**
 * Input shape we pass into the orders module's create-order service.
 * Kept narrow (no items, no discount) because the convert flow creates an
 * empty order that staff will populate with services after conversion.
 *
 * See Trade-off #6 in the plan: "Empty Order on conversion".
 */
export interface CreateOrderPayload {
  customerId: string;
  items: never[];
  notes?: string;
}

/** Result returned from the orders module's create-order service. */
export interface CreatedOrderSnapshot {
  id: string;
  orderNumber?: string;
}

/**
 * Structural port the pickup module uses to create an order. The orders
 * module's `CreateOrderService` matches this shape — wiring happens in the
 * composition root (pickup-requests.module.ts) so neither application layer
 * imports the other.
 */
export interface OrderCreationPort {
  execute(
    input: CreateOrderPayload,
    ctx: BranchRequestContext,
  ): Promise<CreatedOrderSnapshot>;
}

/**
 * SCHEDULED → CONVERTED.
 *
 * Flow:
 *  1. Validate the pickup is SCHEDULED (status guard).
 *  2. Find-or-create the Customer by phone within the branch.
 *  3. Delegate to the orders module to create an empty Order.
 *  4. Link the pickup to the new order via `convertedOrderId`.
 *
 * Idempotency: if `convertedOrderId` is already set, returns that order id
 * without re-running the flow.
 */
export class ConvertPickupToOrderService {
  constructor(
    private pickupRepo: PickupRequestRepository,
    private customerPort: CustomerPort,
    private orderCreation: OrderCreationPort,
  ) {}

  async execute(
    id: string,
    ctx: RequestContext,
  ): Promise<{ orderId: string }> {
    const pickup = await this.pickupRepo.findById(id, ctx.branchIds);
    if (!pickup) throw new NotFoundError("PickupRequest", id);

    // ── Idempotency: already converted ──
    if (pickup.convertedOrderId) {
      return { orderId: pickup.convertedOrderId };
    }

    // ── 1. Status guard ──
    try {
      assertCanTransition(pickup.status, "CONVERTED");
    } catch {
      throw new ConflictError(
        `Pickup request cannot be converted from status ${pickup.status}`,
      );
    }

    // ── 2. Find-or-create customer ──
    let customerId = pickup.customerId;
    if (!customerId) {
      const existing = await this.customerPort.findByPhone(
        pickup.customerPhone,
        pickup.branchId,
      );
      if (existing) {
        customerId = existing.id;
      } else {
        const created = await this.customerPort.create({
          name: pickup.customerName,
          phone: pickup.customerPhone,
          email: pickup.customerEmail,
          branchId: pickup.branchId,
          tenantId: pickup.tenantId,
        });
        customerId = created.id;
      }
    }

    // ── 3. Create empty order via orders module ──
    const notes = buildOrderNotes(pickup);
    const order = await this.orderCreation.execute(
      { customerId, items: [], notes },
      ctx,
    );

    // ── 4. Link pickup → order ──
    // linkConverted is idempotent and atomic — if a concurrent request
    // already converted, we get back that orderId instead of `order.id`.
    const linkResult = await this.pickupRepo.linkConverted(
      id,
      ctx.branchIds,
      order.id,
    );

    return { orderId: linkResult.orderId };
  }
}

/** Compose the order notes with a pickup traceability prefix. */
function buildOrderNotes(pickup: {
  id: string;
  notes: string | null;
  addressText: string | null;
}): string {
  const parts = [`[Pickup #${pickup.id}]`];
  if (pickup.addressText) parts.push(`Address: ${pickup.addressText}`);
  if (pickup.notes) parts.push(pickup.notes);
  return parts.join("\n");
}
