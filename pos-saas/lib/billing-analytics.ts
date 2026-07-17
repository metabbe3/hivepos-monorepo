import { prisma } from "@/lib/prisma";
import { PRICE_PER_OUTLET } from "@/lib/billing";

/**
 * Platform billing overview — live aggregations from Branch + SaaSPayment.
 *
 * MRR derivation (P3-1): count paid outlets with active coverage × unit price.
 * No denormalized MRR column — recomputed on every read.
 */
export async function getPlatformBillingOverview() {
  const now = new Date();
  const [activePaidOutlets, failedCount30d, totalPaidAllTime, paidTenantCount] = await Promise.all([
    // MRR denominator: paid outlets currently in coverage
    prisma.branch.count({
      where: { isFreeTier: false, coverageEnd: { gt: now } },
    }),
    // Failed payments in last 30 days — backlog signal
    prisma.saaSPayment.count({
      where: {
        status: "FAILED",
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    // Lifetime gross — sum of PAID
    prisma.saaSPayment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    // Distinct tenants with at least one currently-covered paid branch
    prisma.tenant.count({
      where: {
        branches: { some: { isFreeTier: false, coverageEnd: { gt: now } } },
      },
    }),
  ]);

  return {
    mrr: activePaidOutlets * PRICE_PER_OUTLET,
    activePaidOutlets,
    failedCount30d,
    lifetimeGross: Number(totalPaidAllTime._sum.amount ?? 0),
    paidTenantCount,
  };
}

export type PaymentLedgerFilters = {
  status?: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  from?: Date;
  to?: Date;
  tenantId?: string;
  page: number; // 1-based
  pageSize: number; // default 20, max 100
};

export async function getPaymentLedger(filters: PaymentLedgerFilters) {
  const where = {
    ...(filters.status && { status: filters.status }),
    ...(filters.tenantId && { tenantId: filters.tenantId }),
    ...((filters.from || filters.to) && {
      createdAt: {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      },
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.saaSPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: { tenant: { select: { name: true, slug: true } } },
    }),
    prisma.saaSPayment.count({ where }),
  ]);

  return {
    rows: rows.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      tenantName: p.tenant.name,
      tenantSlug: p.tenant.slug,
      amount: Number(p.amount),
      status: p.status,
      kind: p.kind,
      monthsPurchased: p.monthsPurchased,
      outletCount: p.outletCount,
      coverageEnd: p.coverageEnd?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}
