import { z } from "zod/v4";
import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  type RouteContext,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { assignDriverService } from "@/modules/pickup-requests/pickup-requests.module";
import type { AssignDriverInput } from "@/modules/pickup-requests/application/dto";

const assignSchema = z.object({
  assignedDriverId: z.string().nullable().optional(),
});

/** POST /api/pickup-requests/[id]/assign — set/clear driver (no status transition). */
export const POST = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("pickupRequests", "edit");
  const { id } = await ctx!.params;
  const raw = await parseBody(req, assignSchema);

  const input: AssignDriverInput = {
    assignedDriverId: raw.assignedDriverId ?? null,
  };

  const pickup = await assignDriverService.execute(id, input, permission);

  return apiSuccess(pickup);
});
