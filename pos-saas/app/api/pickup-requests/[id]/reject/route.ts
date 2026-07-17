import { z } from "zod/v4";
import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  type RouteContext,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { rejectPickupService } from "@/modules/pickup-requests/pickup-requests.module";
import type { RejectPickupInput } from "@/modules/pickup-requests/application/dto";

const rejectSchema = z.object({
  reason: z.string().optional().or(z.literal("")),
});

/** POST /api/pickup-requests/[id]/reject — PENDING|ACCEPTED → REJECTED. */
export const POST = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("pickupRequests", "edit");
  const { id } = await ctx!.params;
  const raw = await parseBody(req, rejectSchema);

  const input: RejectPickupInput = {
    reason: raw.reason || undefined,
  };

  const pickup = await rejectPickupService.execute(id, input, permission);

  return apiSuccess(pickup);
});
