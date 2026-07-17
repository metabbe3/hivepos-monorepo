import { NotFoundError, ConflictError } from "@/modules/shared";
import type { PickupRequestRepository } from "../domain/repository.port";
import { assertCanTransition } from "../domain/status-flow";
import type { PickupRequestDTO } from "./dto";
import { toPickupDTO } from "./mappers";
import type { RequestContext } from "./context";

/** PENDING → ACCEPTED. Records who acknowledged the request. */
export class AcceptPickupService {
  constructor(private pickupRepo: PickupRequestRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<PickupRequestDTO> {
    const pickup = await this.pickupRepo.findById(id, ctx.branchIds);
    if (!pickup) throw new NotFoundError("PickupRequest", id);

    try {
      assertCanTransition(pickup.status, "ACCEPTED");
    } catch {
      throw new ConflictError(
        `Pickup request cannot be accepted from status ${pickup.status}`,
      );
    }

    const now = new Date();
    const updated = await this.pickupRepo.updateStatus(id, ctx.branchIds, {
      status: "ACCEPTED",
      acceptedAt: now,
      acceptedById: ctx.userId,
    });
    return toPickupDTO(updated);
  }
}
