import { NotFoundError } from "@/modules/shared";
import type { PickupRequestRepository } from "../domain/repository.port";
import type { PickupRequestDTO } from "./dto";
import { toPickupDTO } from "./mappers";
import type { RequestContext } from "./context";

/** Fetch a single pickup request by id, scoped to the caller's branches. */
export class GetPickupRequestService {
  constructor(private pickupRepo: PickupRequestRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<PickupRequestDTO> {
    const pickup = await this.pickupRepo.findById(id, ctx.branchIds);
    if (!pickup) {
      throw new NotFoundError("PickupRequest", id);
    }
    return toPickupDTO(pickup);
  }
}
