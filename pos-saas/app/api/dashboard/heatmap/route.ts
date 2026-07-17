import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { endOfDay, wibDateBounds } from "@/lib/dates";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("dashboard", "read");
  const { branchIds, activeModule: moduleFilter } = ctx;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const granularity = searchParams.get("granularity") || "daily";

  const dateFilter = wibDateBounds({ from: fromStr, to: toStr });
  const hasDateFilter = !!(dateFilter.gte || dateFilter.lte);

  const where = hasDateFilter
    ? { branchId: { in: branchIds }, module: moduleFilter, OR: [{ receivedAt: dateFilter }, { receivedAt: null, createdAt: dateFilter }] }
    : { branchId: { in: branchIds }, module: moduleFilter };

  // Calculate previous period for comparison
  let previousFrom: Date | undefined;
  let previousTo: Date | undefined;
  if (fromStr && toStr) {
    const from = new Date(fromStr);
    from.setHours(0, 0, 0, 0);
    const to = endOfDay(new Date(toStr));
    const periodMs = to.getTime() - from.getTime() + 1;
    previousTo = endOfDay(new Date(from.getTime() - 1));
    previousFrom = new Date(previousTo.getTime() - periodMs + 1);
    previousFrom.setHours(0, 0, 0, 0);
  }

  const [orders, payments, customerOrders, previousPayments] = await Promise.all([
    // (a) All orders with receivedAt for hourly/day grid
    prisma.order.findMany({
      where,
      select: { createdAt: true, receivedAt: true, totalAmount: true },
      orderBy: { receivedAt: "asc" },
    }),

    // (b) Payments for revenue by day (include order date for grouping)
    prisma.payment.findMany({
      where: { order: where },
      select: { createdAt: true, amount: true, order: { select: { receivedAt: true, createdAt: true } } },
      orderBy: { createdAt: "asc" },
    }),

    // (c) Customer orders for visit patterns
    prisma.order.findMany({
      where,
      select: {
        customerId: true,
        createdAt: true,
        receivedAt: true,
        customer: { select: { name: true } },
      },
      orderBy: { receivedAt: "asc" },
    }),

    // (d) Previous period payments for trend comparison
    previousFrom && previousTo
      ? prisma.payment.findMany({
          where: { order: { branchId: { in: branchIds }, module: moduleFilter }, createdAt: { gte: previousFrom, lte: previousTo } },
          select: { createdAt: true, amount: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // (1) Hourly by day-of-week: 7 rows (Mon=0..Sun=6) x 24 columns (0..23)
  const hourlyByDay: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const o of orders) {
    const d = new Date((o as any).receivedAt ?? o.createdAt);
    const dow = (d.getDay() + 6) % 7; // Mon=0, Sun=6
    const hour = d.getHours();
    hourlyByDay[dow][hour]++;
  }

  // (2) Revenue by day: last N days (group by order date)
  const revenueByDay: Record<string, number> = {};
  for (const p of payments) {
    const day = new Date((p as any).order?.receivedAt ?? (p as any).order?.createdAt ?? p.createdAt).toISOString().slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(p.amount);
  }

  // (2b) Orders by day for trend chart
  const ordersByDay: Record<string, number> = {};
  for (const o of orders) {
    const day = new Date((o as any).receivedAt ?? o.createdAt).toISOString().slice(0, 10);
    ordersByDay[day] = (ordersByDay[day] ?? 0) + 1;
  }

  // (2c) Previous period revenue by day
  const prevRevenueByDay: Record<string, number> = {};
  for (const p of previousPayments) {
    const day = new Date(p.createdAt).toISOString().slice(0, 10);
    prevRevenueByDay[day] = (prevRevenueByDay[day] ?? 0) + Number(p.amount);
  }

  // (3) Customer visits: top 10 customers by frequency + day-of-week distribution
  const customerMap = new Map<string, { name: string; totalOrders: number; dayDistribution: number[] }>();
  for (const o of customerOrders) {
    const existing = customerMap.get(o.customerId);
    const dow = (new Date((o as any).receivedAt ?? o.createdAt).getDay() + 6) % 7;
    if (existing) {
      existing.totalOrders++;
      existing.dayDistribution[dow]++;
    } else {
      customerMap.set(o.customerId, {
        name: o.customer.name,
        totalOrders: 1,
        dayDistribution: Array(7).fill(0) as number[],
      });
      customerMap.get(o.customerId)!.dayDistribution[dow] = 1;
    }
  }
  const customerVisits = Array.from(customerMap.entries())
    .map(([id, data]) => ({ customerId: id, ...data }))
    .sort((a, b) => b.totalOrders - a.totalOrders)
    .slice(0, 15);

  // (4) Revenue trend with previous period overlay
  const revenueTrend = buildRevenueTrend(revenueByDay, ordersByDay, prevRevenueByDay, granularity, fromStr, toStr);

  return apiSuccess({
    hourlyByDay,
    revenueByDay,
    customerVisits,
    revenueTrend,
  });
});

function buildRevenueTrend(
  dailyRevenue: Record<string, number>,
  dailyOrders: Record<string, number>,
  prevDailyRevenue: Record<string, number>,
  granularity: string,
  fromStr: string | null,
  toStr: string | null,
) {
  if (!fromStr || !toStr) return [];

  // Calculate period offset for previous period mapping
  const fromDate = new Date(fromStr);
  const toDate = new Date(toStr);
  const periodDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Generate date range
  const days: string[] = [];
  const d = new Date(fromStr);
  const end = new Date(toStr);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  if (granularity === "daily") {
    return days.map((day) => {
      const offset = new Date(day);
      offset.setDate(offset.getDate() - periodDays);
      const prevDay = offset.toISOString().slice(0, 10);
      return {
        date: day.slice(5), // "MM-DD" for readability
        revenue: dailyRevenue[day] ?? 0,
        orders: dailyOrders[day] ?? 0,
        previousRevenue: prevDailyRevenue[prevDay] ?? 0,
      };
    });
  }

  // For weekly/monthly: aggregate both periods independently, then align by index
  if (granularity === "weekly") {
    const currentBuckets = aggregateByBucket(days, dailyRevenue, dailyOrders, getISOWeek);
    const prevDays = days.map((day) => {
      const offset = new Date(day);
      offset.setDate(offset.getDate() - periodDays);
      return offset.toISOString().slice(0, 10);
    });
    const prevBuckets = aggregateByBucket(prevDays, prevDailyRevenue, {}, getISOWeek);

    const currentArr = Object.entries(currentBuckets).sort(([a], [b]) => a.localeCompare(b));
    const prevArr = Object.entries(prevBuckets).sort(([a], [b]) => a.localeCompare(b));

    return currentArr.map(([key, data], i) => ({
      date: key,
      revenue: data.revenue,
      orders: data.orders,
      previousRevenue: i < prevArr.length ? prevArr[i][1].revenue : 0,
    }));
  }

  if (granularity === "monthly") {
    const toMonth = (day: string) => day.slice(0, 7);
    const currentBuckets = aggregateByBucket(days, dailyRevenue, dailyOrders, toMonth);
    const prevDays = days.map((day) => {
      const offset = new Date(day);
      offset.setDate(offset.getDate() - periodDays);
      return offset.toISOString().slice(0, 10);
    });
    const prevBuckets = aggregateByBucket(prevDays, prevDailyRevenue, {}, toMonth);

    const currentArr = Object.entries(currentBuckets).sort(([a], [b]) => a.localeCompare(b));
    const prevArr = Object.entries(prevBuckets).sort(([a], [b]) => a.localeCompare(b));

    return currentArr.map(([key, data], i) => ({
      date: key,
      revenue: data.revenue,
      orders: data.orders,
      previousRevenue: i < prevArr.length ? prevArr[i][1].revenue : 0,
    }));
  }

  return [];
}

function aggregateByBucket(
  days: string[],
  revenueMap: Record<string, number>,
  ordersMap: Record<string, number>,
  bucketFn: (day: string) => string,
): Record<string, { revenue: number; orders: number }> {
  const buckets: Record<string, { revenue: number; orders: number }> = {};
  for (const day of days) {
    const key = bucketFn(day);
    if (!buckets[key]) buckets[key] = { revenue: 0, orders: 0 };
    buckets[key].revenue += revenueMap[day] ?? 0;
    buckets[key].orders += ordersMap[day] ?? 0;
  }
  return buckets;
}

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
