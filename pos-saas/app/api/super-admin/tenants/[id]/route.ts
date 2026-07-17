import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  NotFoundError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";

export const GET = withErrorHandler(
  async (_req: Request, ctx) => {
    await assertSuperAdminOrThrow();
    const { id } = await ctx!.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { branches: true, users: true, saaSPayments: true } },
      },
    });

    if (!tenant) throw new NotFoundError("Tenant", id);

    return apiSuccess({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        ownerEmail: tenant.ownerEmail,
        ownerName: tenant.ownerName,
        ownerPhone: tenant.ownerPhone,
        customDomain: tenant.customDomain,
        activeModules: tenant.activeModules,
        isActive: tenant.isActive,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
        createdAt: tenant.createdAt.toISOString(),
        plan: tenant.subscription?.plan
          ? {
              name: tenant.subscription.plan.name,
              priceMonthly: Number(tenant.subscription.plan.priceMonthly),
            }
          : null,
        subscriptionStatus: tenant.subscription?.status ?? null,
        counts: {
          branches: tenant._count.branches,
          users: tenant._count.users,
          saaSPayments: tenant._count.saaSPayments,
        },
      },
    });
  },
);
