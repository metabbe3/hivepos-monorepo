import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrThrow } from "@/lib/permissions/check";

// Marks the owner's onboarding complete (Done or Skip). The /onboarding page
// then calls update({ refreshOnboarding: true }) so the JWT picks up the new
// timestamp and /dashboard stops redirecting here.
export const PATCH = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("branches", "edit");
  await prisma.tenant.update({
    where: { id: ctx.tenantId },
    data: { onboardingCompletedAt: new Date() },
  });
  return apiSuccess({ ok: true });
});
