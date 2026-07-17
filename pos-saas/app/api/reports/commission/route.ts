import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { buildDateFilter } from "@/lib/format";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "read");
  const { branchIds } = ctx;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const { hasFilter, dateFilter, where } = buildDateFilter(fromStr, toStr);
  const itemWhere = hasFilter ? { order: { ...where, branchId: { in: branchIds } } } : { order: { branchId: { in: branchIds } } };

  const [serviceGroups, allServices] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: itemWhere,
      _sum: { quantity: true, weightKg: true, subtotal: true },
      _count: true,
    }),
    prisma.service.findMany({
      where: { branchId: { in: branchIds } },
      select: { id: true, name: true, pricingType: true, commissionType: true, commissionValue: true },
    }),
  ]);

  const serviceMap = new Map(allServices.map((s) => [s.id, { ...s, commissionValue: Number(s.commissionValue) }]));

  const byService = serviceGroups.map((g) => {
    const svc = serviceMap.get(g.serviceId);
    const revenue = Number(g._sum.subtotal ?? 0);
    const totalQty = Number(g._sum.quantity ?? 0);
    const totalWeightKg = Number(g._sum.weightKg ?? 0);
    const commissionType = svc?.commissionType ?? "NONE";
    const commissionValue = Number(svc?.commissionValue ?? 0);

    let commission = 0;
    if (commissionType === "FLAT") {
      commission = svc?.pricingType === "PER_KG"
        ? commissionValue * totalWeightKg
        : commissionValue * totalQty;
    } else if (commissionType === "PERCENTAGE") {
      commission = revenue * (commissionValue / 100);
    }

    return {
      serviceId: g.serviceId,
      name: svc?.name ?? "Unknown",
      pricingType: svc?.pricingType ?? "PER_ITEM",
      orderCount: g._count,
      revenue,
      commissionType,
      commissionValue,
      commission: Math.round(commission),
    };
  });

  const totalRevenue = byService.reduce((sum, s) => sum + s.revenue, 0);
  const totalCommission = byService.reduce((sum, s) => sum + s.commission, 0);

  return apiSuccess({
    summary: { totalRevenue, totalCommission },
    byService: byService.sort((a, b) => b.commission - a.commission),
  });
});
