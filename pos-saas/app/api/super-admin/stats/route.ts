import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/get-session";
import { withErrorHandler, apiSuccess, UnauthenticatedError, ForbiddenError } from "@/modules/shared";

export const GET = withErrorHandler(async () => {
  // ─── AUTH: Super admin only ───
  const session = await getApiSession() as any;
  if (!session) throw new UnauthenticatedError();
  if (session.user.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Super admin access required");
  }

  const [
    totalTenants,
    activeTenants,
    totalUsers,
    totalOrders,
    trialTenants,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.order.count(),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
  ]);

  // Revenue proxy: sum of all paid orders
  const revenueAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
  });

  const recentTenants = await prisma.tenant.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { branches: true, users: true } },
    },
  });

  return apiSuccess({
    stats: {
      totalTenants,
      activeTenants,
      trialTenants,
      totalUsers,
      totalOrders,
      totalRevenue: revenueAgg._sum.amount || 0,
    },
    tenants: recentTenants,
  });
});
