import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TenantSortKey =
  | "rev30d"
  | "revAll"
  | "orders30d"
  | "ordersAll"
  | "name"
  | "createdAt";

export type TenantPerformanceRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  activeOutlets: number;
  totalOutlets: number;
  orders30d: number;
  ordersAll: number;
  revenue30d: number;
  revenueAll: number;
  saasRevenuePaid: number;
  daysSinceLastOrder: number | null;
  createdAt: string;
};

// ponytail: ~6N queries for N tenants. Fine at N<100. At N>200 refactor to two
// raw SQL `GROUP BY branch."tenantId"` queries.
export async function getTenantPerformance(
  options: { sort?: TenantSortKey } = {},
): Promise<TenantPerformanceRow[]> {
  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * DAY_MS);

  const tenants = await prisma.tenant.findMany({
    include: {
      subscription: { select: { status: true } },
      branches: { select: { id: true, isActive: true } },
    },
  });

  const branchIdsByTenant = new Map<string, string[]>();
  for (const t of tenants) {
    branchIdsByTenant.set(
      t.id,
      t.branches.map((b) => b.id),
    );
  }

  const results = await Promise.all(
    tenants.flatMap((t) => {
      const branchIds = branchIdsByTenant.get(t.id) ?? [];
      const branchFilter = branchIds.length ? { in: branchIds } : { in: ["__none__"] };
      return [
        prisma.order
          .aggregate({
            _count: { _all: true },
            where: {
              branchId: branchFilter,
              createdAt: { gte: since30d },
              status: { not: "CANCELED" },
            },
          })
          .then((a) => ["orders30d", t.id, a._count._all] as const),
        prisma.order
          .aggregate({
            _count: { _all: true },
            where: { branchId: branchFilter, status: { not: "CANCELED" } },
          })
          .then((a) => ["ordersAll", t.id, a._count._all] as const),
        prisma.payment
          .aggregate({
            _sum: { amount: true },
            where: {
              paidAt: { gte: since30d },
              order: { branchId: branchFilter },
            },
          })
          .then((a) => ["rev30d", t.id, Number(a._sum.amount ?? 0)] as const),
        prisma.payment
          .aggregate({
            _sum: { amount: true },
            where: { order: { branchId: branchFilter } },
          })
          .then((a) => ["revAll", t.id, Number(a._sum.amount ?? 0)] as const),
        prisma.saaSPayment
          .aggregate({
            _sum: { amount: true },
            where: { tenantId: t.id, status: "PAID" },
          })
          .then((a) => ["saasPaid", t.id, Number(a._sum.amount ?? 0)] as const),
        prisma.order
          .findFirst({
            where: { branchId: branchFilter },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          })
          .then((o) => ["lastOrder", t.id, o?.createdAt ?? null] as const),
      ];
    }),
  );

  const buckets: Record<string, Map<string, number | Date | null>> = {
    orders30d: new Map(),
    ordersAll: new Map(),
    rev30d: new Map(),
    revAll: new Map(),
    saasPaid: new Map(),
    lastOrder: new Map(),
  };
  for (const [key, tenantId, value] of results) {
    buckets[key].set(tenantId, value as number | Date | null);
  }

  const rows: TenantPerformanceRow[] = tenants.map((t) => {
    const lastDate = buckets.lastOrder.get(t.id) as Date | null | undefined;
    const trialEndsAt = t.trialEndsAt;
    const trialDaysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS))
      : null;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      isActive: t.isActive,
      subscriptionStatus: t.subscription?.status ?? null,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      trialDaysRemaining,
      activeOutlets: t.branches.filter((b) => b.isActive).length,
      totalOutlets: t.branches.length,
      orders30d: (buckets.orders30d.get(t.id) as number) ?? 0,
      ordersAll: (buckets.ordersAll.get(t.id) as number) ?? 0,
      revenue30d: (buckets.rev30d.get(t.id) as number) ?? 0,
      revenueAll: (buckets.revAll.get(t.id) as number) ?? 0,
      saasRevenuePaid: (buckets.saasPaid.get(t.id) as number) ?? 0,
      daysSinceLastOrder: lastDate
        ? Math.floor((now.getTime() - lastDate.getTime()) / DAY_MS)
        : null,
      createdAt: t.createdAt.toISOString(),
    };
  });

  const sortKey: TenantSortKey = options.sort ?? "rev30d";
  const cmp: Record<TenantSortKey, (a: TenantPerformanceRow, b: TenantPerformanceRow) => number> = {
    rev30d: (a, b) => b.revenue30d - a.revenue30d,
    revAll: (a, b) => b.revenueAll - a.revenueAll,
    orders30d: (a, b) => b.orders30d - a.orders30d,
    ordersAll: (a, b) => b.ordersAll - a.ordersAll,
    name: (a, b) => a.name.localeCompare(b.name),
    createdAt: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  };
  rows.sort(cmp[sortKey]);
  return rows;
}

export type TenantPerformanceDetail = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    ownerEmail: string;
    ownerName: string | null;
    ownerPhone: string | null;
    customDomain: string | null;
    activeModules: string[];
    isActive: boolean;
    trialEndsAt: Date | null;
    createdAt: Date;
  };
  branches: { id: string; name: string; isActive: boolean }[];
  planName: string;
  subscriptionStatus: string | null;
  orders30d: number;
  ordersAll: number;
  revenue30d: number;
  revenueAll: number;
  saasRevenuePaid: number;
  daysSinceLastOrder: number | null;
  activeOutlets: number;
  totalOutlets: number;
  trialDaysRemaining: number | null;
  recentPayments: {
    id: string;
    amount: number;
    status: string;
    kind: string;
    outletCount: number;
    monthsPurchased: number;
    coverageEnd: Date | null;
    createdAt: Date;
    paidAt: Date | null;
  }[];
};

export async function getTenantPerformanceById(
  tenantId: string,
): Promise<TenantPerformanceDetail | null> {
  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * DAY_MS);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: { include: { plan: true } },
      branches: { select: { id: true, name: true, isActive: true } },
    },
  });
  if (!tenant) return null;

  const branchIds = tenant.branches.map((b) => b.id);
  const branchFilter = branchIds.length ? { in: branchIds } : { in: ["__none__"] };

  const [orders30d, ordersAll, rev30d, revAll, saasPaid, lastOrder, recentPayments] =
    await Promise.all([
      prisma.order.count({
        where: {
          branchId: branchFilter,
          createdAt: { gte: since30d },
          status: { not: "CANCELED" },
        },
      }),
      prisma.order.count({
        where: { branchId: branchFilter, status: { not: "CANCELED" } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidAt: { gte: since30d }, order: { branchId: branchFilter } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { order: { branchId: branchFilter } },
      }),
      prisma.saaSPayment.aggregate({
        _sum: { amount: true },
        where: { tenantId, status: "PAID" },
      }),
      prisma.order.findFirst({
        where: { branchId: branchFilter },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.saaSPayment.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          status: true,
          kind: true,
          outletCount: true,
          monthsPurchased: true,
          coverageEnd: true,
          createdAt: true,
          paidAt: true,
        },
      }),
    ]);

  const trialDaysRemaining = tenant.trialEndsAt
    ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / DAY_MS))
    : null;

  return {
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
      trialEndsAt: tenant.trialEndsAt,
      createdAt: tenant.createdAt,
    },
    branches: tenant.branches,
    planName: tenant.subscription?.plan.name ?? "—",
    subscriptionStatus: tenant.subscription?.status ?? null,
    orders30d,
    ordersAll,
    revenue30d: Number(rev30d._sum.amount ?? 0),
    revenueAll: Number(revAll._sum.amount ?? 0),
    saasRevenuePaid: Number(saasPaid._sum.amount ?? 0),
    daysSinceLastOrder: lastOrder
      ? Math.floor((now.getTime() - lastOrder.createdAt.getTime()) / DAY_MS)
      : null,
    activeOutlets: tenant.branches.filter((b) => b.isActive).length,
    totalOutlets: tenant.branches.length,
    trialDaysRemaining,
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      kind: p.kind,
      outletCount: p.outletCount,
      monthsPurchased: p.monthsPurchased,
      coverageEnd: p.coverageEnd,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
    })),
  };
}
