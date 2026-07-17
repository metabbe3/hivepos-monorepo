import { NotFoundError, ValidationError } from "@/modules/shared";
import type { PickupRequestRepository } from "../domain/repository.port";
import { isTerminalStatus } from "../domain/status-flow";
import type { AssignDriverInput, PickupRequestDTO } from "./dto";
import { toPickupDTO } from "./mappers";
import type { RequestContext } from "./context";

/**
 * Assign (or unassign) a driver to a pickup request.
 *
 * Allowed from ACCEPTED or SCHEDULED. The driver concept is a plain string
 * ID for now — no User FK — so this just sets/clears the field.
 */
export class AssignDriverService {
  constructor(private pickupRepo: PickupRequestRepository) {}

  async execute(
    id: string,
    input: AssignDriverInput,
    ctx: RequestContext,
  ): Promise<PickupRequestDTO> {
    if (input.assignedDriverId === "") {
      throw new ValidationError("assignedDriverId must be a non-empty string or null");
    }

    const pickup = await this.pickupRepo.findById(id, ctx.branchIds);
    if (!pickup) throw new NotFoundError("PickupRequest", id);

    // No status transition here — driver can be assigned in any non-terminal state.
    if (isTerminalStatus(pickup.status)) {
      throw new ValidationError(
        `Cannot assign driver to a pickup in terminal status ${pickup.status}`,
      );
    }

    const updated = await this.pickupRepo.updateStatus(id, ctx.branchIds, {
      status: pickup.status,
      assignedDriverId: input.assignedDriverId,
    });
    return toPickupDTO(updated);
  }
}
