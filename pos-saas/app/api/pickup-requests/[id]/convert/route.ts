import { withErrorHandler, apiSuccess, type RouteContext } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import {
  convertPickupService,
  getPickupService,
} from "@/modules/pickup-requests/pickup-requests.module";

/** POST /api/pickup-requests/[id]/convert — SCHEDULED → CONVERTED (creates Order). */
export const POST = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("pickupRequests", "edit");
  const { id } = await ctx!.params;

  await convertPickupService.execute(id, permission);

  // Re-fetch the full DTO so the dialog can re-render with the linked order
  // and all snapshot fields intact (the convert service only returns orderId).
  const pickup = await getPickupService.execute(id, permission);

  return apiSuccess(pickup);
});
