import { NotFoundError, InvalidStatusTransitionError } from "@/modules/shared";
import type { OrderRepository } from "../domain/repository.port";
import { canTransition } from "../domain/status-flow";
import type { RequestContext } from "./context";
import type { AdvanceStatusInput } from "./dto";

export class AdvanceStatusService {
  constructor(private orderRepo: OrderRepository) {}

  async execute(
    orderId: string,
    input: AdvanceStatusInput,
    ctx: RequestContext,
  ) {
    // ── 1. Load order (need current status) ──
    const order = await this.orderRepo.findById(orderId, ctx.branchId);
    if (!order) {
      throw new NotFoundError("Order", orderId);
    }

    // ── 2. Validate transition (domain rule) ──
    if (!canTransition(order.status, input.status)) {
      throw new InvalidStatusTransitionError(order.status, input.status);
    }

    // ── 3. Persist ──
    return this.orderRepo.advanceStatus(orderId, ctx.branchId, input.status);
  }
}
