import { NotFoundError, ConflictError, ValidationError } from "@/modules/shared";
import type { PickupRequestRepository } from "../domain/repository.port";
import { assertCanTransition } from "../domain/status-flow";
import type { SchedulePickupInput, PickupRequestDTO } from "./dto";
import { toPickupDTO } from "./mappers";
import type { RequestContext } from "./context";

/** ACCEPTED → SCHEDULED. Sets the pickup date, slot, and optional driver. */
export class SchedulePickupService {
  constructor(private pickupRepo: PickupRequestRepository) {}

  async execute(
    id: string,
    input: SchedulePickupInput,
    ctx: RequestContext,
  ): Promise<PickupRequestDTO> {
    // ── Validate input ──
    if (!input.requestedDate) {
      throw new ValidationError("Tanggal pengambilan wajib diisi.");
    }
    const d = new Date(input.requestedDate);
    if (isNaN(d.getTime())) {
      throw new ValidationError("Tanggal pengambilan tidak valid.");
    }
    const requestedDate = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    const requestedSlot = input.requestedSlot?.trim();
    if (!requestedSlot) {
      throw new ValidationError("Jam pengambilan wajib dipilih.");
    }

    // ── Load + check transition ──
    const pickup = await this.pickupRepo.findById(id, ctx.branchIds);
    if (!pickup) throw new NotFoundError("PickupRequest", id);

    try {
      assertCanTransition(pickup.status, "SCHEDULED");
    } catch {
      throw new ConflictError(
        `Pickup request cannot be scheduled from status ${pickup.status}`,
      );
    }

    const now = new Date();
    const updated = await this.pickupRepo.updateStatus(id, ctx.branchIds, {
      status: "SCHEDULED",
      scheduledAt: now,
      scheduledById: ctx.userId,
      requestedDate,
      requestedSlot,
      ...(input.assignedDriverId !== undefined
        ? { assignedDriverId: input.assignedDriverId }
        : {}),
    });
    return toPickupDTO(updated);
  }
}
