import { prisma } from "@/lib/prisma";

export type PickupInsights = {
  totalRejected: number;
  totalAll: number;
  rejectionRate: number; // 0..1
  topReasons: { reason: string; count: number; pct: number }[];
  topTenantsByRate: {
    tenantId: string;
    tenantName: string;
    rejected: number;
    total: number;
    rate: number;
  }[];
  topBranchesByRate: {
    branchId: string;
    branchName: string;
    tenantId: string | null;
    tenantName: string;
    rejected: number;
    total: number;
    rate: number;
  }[];
};

export async function getPickupInsights(filters: {
  from?: Date;
  to?: Date;
}): Promise<PickupInsights> {
  const dateWhere = {
    ...((filters.from || filters.to) && {
      createdAt: {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      },
    }),
  };

  const [
    totalRejected,
    totalAll,
    reasonsRaw,
    allByTenantRaw,
    rejByTenantRaw,
    allByBranchRaw,
    rejByBranchRaw,
  ] = await Promise.all([
    prisma.pickupRequest.count({ where: { ...dateWhere, status: "REJECTED" } }),
    prisma.pickupRequest.count({ where: dateWhere }),
    prisma.pickupRequest.groupBy({
      by: ["rejectedReason"],
      where: { ...dateWhere, status: "REJECTED" },
      _count: { _all: true },
      orderBy: { _count: { rejectedReason: "desc" } },
      take: 10,
    }),
    prisma.pickupRequest.groupBy({
      by: ["tenantId"],
      where: dateWhere,
      _count: { _all: true },
    }),
    prisma.pickupRequest.groupBy({
      by: ["tenantId"],
      where: { ...dateWhere, status: "REJECTED" },
      _count: { _all: true },
    }),
    prisma.pickupRequest.groupBy({
      by: ["branchId"],
      where: dateWhere,
      _count: { _all: true },
    }),
    prisma.pickupRequest.groupBy({
      by: ["branchId"],
      where: { ...dateWhere, status: "REJECTED" },
      _count: { _all: true },
    }),
  ]);

  // ponytail: merge all+rejected grouped counts in JS to compute rates. Simpler
  // than raw SQL and fine at current scale.
  const allByTenant = new Map(allByTenantRaw.map((r) => [r.tenantId, r._count._all]));
  const rejByTenant = new Map(rejByTenantRaw.map((r) => [r.tenantId, r._count._all]));
  const allByBranch = new Map(allByBranchRaw.map((r) => [r.branchId, r._count._all]));
  const rejByBranch = new Map(rejByBranchRaw.map((r) => [r.branchId, r._count._all]));

  const tenantIds = [...allByTenant.keys()];
  const tenants =
    tenantIds.length > 0
      ? await prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : [];
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));

  const branchIds = [...allByBranch.keys()];
  const branches =
    branchIds.length > 0
      ? await prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true, tenantId: true },
        })
      : [];
  const branchInfo = new Map(branches.map((b) => [b.id, b]));

  const topReasons = reasonsRaw.map((r) => ({
    reason: r.rejectedReason ?? "(no reason)",
    count: r._count._all,
    pct: totalRejected > 0 ? r._count._all / totalRejected : 0,
  }));

  const topTenantsByRate = [...allByTenant.entries()]
    .map(([tenantId, total]) => {
      const rejected = rejByTenant.get(tenantId) ?? 0;
      return {
        tenantId,
        tenantName: tenantName.get(tenantId) ?? "—",
        rejected,
        total,
        rate: total > 0 ? rejected / total : 0,
      };
    })
    .filter((r) => r.rejected > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);

  const topBranchesByRate = [...allByBranch.entries()]
    .map(([branchId, total]) => {
      const rejected = rejByBranch.get(branchId) ?? 0;
      const info = branchInfo.get(branchId);
      return {
        branchId,
        branchName: info?.name ?? "—",
        tenantId: info?.tenantId ?? null,
        tenantName: (info?.tenantId && tenantName.get(info.tenantId)) ?? "—",
        rejected,
        total,
        rate: total > 0 ? rejected / total : 0,
      };
    })
    .filter((r) => r.rejected > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);

  return {
    totalRejected,
    totalAll,
    rejectionRate: totalAll > 0 ? totalRejected / totalAll : 0,
    topReasons,
    topTenantsByRate,
    topBranchesByRate,
  };
}
