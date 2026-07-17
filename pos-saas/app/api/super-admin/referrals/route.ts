import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";

// GET — list all referrals (the abuse-oversight ledger).
export const GET = withErrorHandler(async () => {
  await assertSuperAdminOrThrow();

  const referrals = await prisma.referral.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      referrer: { select: { name: true, slug: true, referralCode: true } },
      referred: { select: { name: true, slug: true } },
    },
  });

  return apiSuccess({
    referrals: referrals.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      rewardMonths: r.rewardMonths,
      createdAt: r.createdAt.toISOString(),
      rewardedAt: r.rewardedAt?.toISOString() ?? null,
      referrer: r.referrer
        ? { name: r.referrer.name, slug: r.referrer.slug, code: r.referrer.referralCode ?? "-" }
        : null,
      referred: r.referred ? { name: r.referred.name, slug: r.referred.slug } : null,
    })),
  });
});
