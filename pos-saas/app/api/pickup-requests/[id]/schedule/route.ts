import { z } from "zod/v4";
import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  type RouteContext,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { schedulePickupService } from "@/modules/pickup-requests/pickup-requests.module";
import type { SchedulePickupInput } from "@/modules/pickup-requests/application/dto";

const scheduleSchema = z.object({
  requestedDate: z.string().min(1, "Tanggal wajib diisi."),
  requestedSlot: z.string().min(1, "Jam pengambilan wajib dipilih."),
  assignedDriverId: z.string().optional().or(z.literal("")).nullable(),
});

/** POST /api/pickup-requests/[id]/schedule — ACCEPTED → SCHEDULED. */
export const POST = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("pickupRequests", "edit");
  const { id } = await ctx!.params;
  const raw = await parseBody(req, scheduleSchema);

  const input: SchedulePickupInput = {
    requestedDate: raw.requestedDate,
    requestedSlot: raw.requestedSlot,
    assignedDriverId: raw.assignedDriverId || undefined,
  };

  const pickup = await schedulePickupService.execute(id, input, permission);

  return apiSuccess(pickup);
});
