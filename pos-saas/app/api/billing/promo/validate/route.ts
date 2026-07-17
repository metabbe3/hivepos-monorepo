import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { validatePromoService } from "@/modules/billing/billing.module";
import { rateLimit } from "@/lib/rate-limit";

export const POST = withErrorHandler(async (req) => {
  rateLimit(req, { limit: 20, windowSeconds: 60 });

  const ctx = await requirePermissionOrThrow("billing", "read");

  const body = await req.json();
  const result = await validatePromoService.execute(
    {
      code: body?.code as string,
      branchIds: Array.isArray(body?.branchIds) ? body.branchIds : undefined,
      months: body?.months ? Number(body.months) : undefined,
      planTier:
        body?.planTier === "PRO"
          ? "PRO"
          : body?.planTier === "GROWTH"
            ? "GROWTH"
            : undefined,
    },
    ctx,
  );

  return apiSuccess(result);
});
