import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { ForbiddenError } from "@/modules/shared/errors/app-error";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { createCheckoutService } from "@/modules/billing/billing.module";

export const POST = withErrorHandler(async (req) => {
  const ctx = await requirePermissionOrThrow("billing", "read");

  // Sandbox demo tenants can't subscribe / be billed.
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { isDemo: true },
  });
  if (tenant?.isDemo) {
    throw new ForbiddenError("Akun demo tidak bisa berlangganan. Daftar akun sendiri dulu.");
  }

  const body = await req.json();
  const result = await createCheckoutService.execute(
    {
      months: Number(body?.months) || 1,
      branchIds: Array.isArray(body?.branchIds) ? body.branchIds : [],
      promoCode: body?.promoCode as string | undefined,
      planTier: body?.planTier === "PRO" ? "PRO" : "GROWTH",
    },
    ctx,
  );

  return apiSuccess(result);
});
