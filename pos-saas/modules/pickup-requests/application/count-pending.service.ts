import type { PickupRequestRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";

/**
 * Returns the count of PENDING pickup requests for the caller's branches.
 * Used by the sidebar badge (polled every ~45s).
 */
export class CountPendingPickupsService {
  constructor(private pickupRepo: PickupRequestRepository) {}

  async execute(ctx: RequestContext): Promise<{ count: number }> {
    const count = await this.pickupRepo.countPending(ctx.branchIds);
    return { count };
  }
}
