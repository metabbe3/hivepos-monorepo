import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess, NotFoundError } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { invalidateFeatureFlags } from "@/lib/feature-flags";

// DELETE — remove per-tenant override (tenant inherits global default again)
export const DELETE = withErrorHandler(
  async (req, ctx) => {
    const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id, tenantId } = await ctx!.params;

    const existing = await prisma.tenantFeatureFlag.findUnique({
      where: { flagId_tenantId: { flagId: id, tenantId } },
    });
    if (!existing) throw new NotFoundError("Override not found");

    await prisma.$transaction(async (tx) => {
      await tx.tenantFeatureFlag.delete({
        where: { flagId_tenantId: { flagId: id, tenantId } },
      });
      await auditLog(tx, {
        actor,
        action: "featureFlag.tenantOverrideRemoved",
        target: { type: "FeatureFlag", id },
        diff: { tenantId },
        req,
      });
    });

    invalidateFeatureFlags(tenantId); // per-tenant override removed

    return apiSuccess({ ok: true });
  },
);
