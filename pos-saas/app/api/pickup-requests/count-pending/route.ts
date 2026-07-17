import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { countPendingPickupsService } from "@/modules/pickup-requests/pickup-requests.module";

/** GET /api/pickup-requests/count-pending — badge count. */
export const GET = withErrorHandler(async () => {
  const permission = await requireWithBranchOrThrow("pickupRequests", "read");

  const result = await countPendingPickupsService.execute(permission);

  return apiSuccess(result);
});
