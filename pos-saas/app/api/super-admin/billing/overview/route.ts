import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { getPlatformBillingOverview } from "@/lib/billing-analytics";

export const GET = withErrorHandler(async () => {
  await assertSuperAdminOrThrow(); // SUPER_ADMIN or SUPPORT
  return apiSuccess(await getPlatformBillingOverview());
});
