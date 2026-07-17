import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";

export const GET = withErrorHandler(
  async (req: Request, ctx) => {
    await assertSuperAdminOrThrow();
    const { id } = await ctx!.params;
    const url = new URL(req.url);
    const take = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);

    const payments = await prisma.saaSPayment.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        amount: true,
        status: true,
        kind: true,
        monthsPurchased: true,
        outletCount: true,
        unitPrice: true,
        promoCodeId: true,
        coverageStart: true,
        coverageEnd: true,
        createdAt: true,
        paidAt: true,
      },
    });

    return apiSuccess({
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        unitPrice: Number(p.unitPrice),
        coverageStart: p.coverageStart?.toISOString() ?? null,
        coverageEnd: p.coverageEnd?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
      })),
    });
  },
);
