import { NotFoundError, ConflictError } from "@/modules/shared";
import type { PickupRequestRepository } from "../domain/repository.port";
import { assertCanTransition } from "../domain/status-flow";
import type { RejectPickupInput, PickupRequestDTO } from "./dto";
import { toPickupDTO } from "./mappers";
import type { RequestContext } from "./context";

/** PENDING/ACCEPTED → REJECTED. Records who rejected and why. */
export class RejectPickupService {
  constructor(private pickupRepo: PickupRequestRepository) {}

  async execute(
    id: string,
    input: RejectPickupInput,
    ctx: RequestContext,
  ): Promise<PickupRequestDTO> {
    const pickup = await this.pickupRepo.findById(id, ctx.branchIds);
    if (!pickup) throw new NotFoundError("PickupRequest", id);

    try {
      assertCanTransition(pickup.status, "REJECTED");
    } catch {
      throw new ConflictError(
        `Pickup request cannot be rejected from status ${pickup.status}`,
      );
    }

    const now = new Date();
    const updated = await this.pickupRepo.updateStatus(id, ctx.branchIds, {
      status: "REJECTED",
      rejectedAt: now,
      rejectedById: ctx.userId,
      rejectedReason: input.reason?.trim() || null,
    });
    return toPickupDTO(updated);
  }
}
