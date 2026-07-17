import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { getBillingStatusService } from "@/modules/billing/billing.module";

export const GET = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("billing", "read");
  const status = await getBillingStatusService.execute(ctx);
  return apiSuccess(status);
});
