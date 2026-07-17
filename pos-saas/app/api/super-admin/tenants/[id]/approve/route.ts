import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  NotFoundError,
  ConflictError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { TRIAL_DAYS } from "@/lib/billing";

// Trial length is centralized in lib/billing.ts (TRIAL_DAYS = 14) so a manual
// approve grants the same window as registration.
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

// POST → approve a pending tenant. Sets isActive + approvedAt + trial dates.
// Errors if already approved (approvedAt !== null).
export const POST = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { approvedAt: true, trialEndsAt: true },
    });
    if (!tenant) throw new NotFoundError("Tenant", id);
    if (tenant.approvedAt) {
      throw new ConflictError("Tenant is already approved");
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_MS);

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id },
        data: { isActive: true, approvedAt: now, trialEndsAt },
      });
      // Set subscription.currentPeriodEnd if a subscription exists.
      // Ponytail: skip-if-null is simpler than upsert — subs is created at registration.
      const sub = await tx.subscription.findUnique({ where: { tenantId: id } });
      if (sub) {
        await tx.subscription.update({
          where: { tenantId: id },
          data: { currentPeriodEnd: trialEndsAt },
        });
      }
      await auditLog(tx, {
        actor,
        action: "tenant.approve",
        target: { type: "Tenant", id, tenantId: id },
        diff: {
          isActive: { from: false, to: true },
          approvedAt: { from: null, to: now },
          trialEndsAt: { from: tenant.trialEndsAt, to: trialEndsAt },
        },
        req,
      });
    });

    return apiSuccess({ tenant: { id, isActive: true, approvedAt: now, trialEndsAt } });
  },
);
