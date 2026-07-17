import { withErrorHandler, apiSuccess, type RouteContext } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { acceptPickupService } from "@/modules/pickup-requests/pickup-requests.module";

/** POST /api/pickup-requests/[id]/accept — PENDING → ACCEPTED. */
export const POST = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("pickupRequests", "edit");
  const { id } = await ctx!.params;

  const pickup = await acceptPickupService.execute(id, permission);

  return apiSuccess(pickup);
});
