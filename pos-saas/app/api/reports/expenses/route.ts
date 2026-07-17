import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "read");
  const { branchIds } = ctx;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Build date filter on Expense.date field (not createdAt)
  const dateFilter: any = {};
  if (from) dateFilter.date = { ...dateFilter.date, gte: new Date(from) };
  if (to) dateFilter.date = { ...dateFilter.date, lte: new Date(to + "T23:59:59") };

  const expenseWhere = {
    branchId: { in: branchIds },
    ...(Object.keys(dateFilter).length > 0 ? dateFilter : {}),
  };

  const [totalResult, byCategory, expensesForDaily] = await Promise.all([
    prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: expenseWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      select: { date: true, amount: true },
      orderBy: { date: "asc" },
    }),
  ]);

  // Resolve category names for the grouped breakdown
  const categoryIds = (byCategory.map((c) => c.categoryId).filter(Boolean) as string[]);
  const categories = categoryIds.length > 0
    ? await prisma.expenseCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Build daily trend
  const dailyMap = new Map<string, { total: number; count: number }>();
  for (const e of expensesForDaily) {
    const day = new Date(e.date).toISOString().slice(0, 10);
    const entry = dailyMap.get(day) ?? { total: 0, count: 0 };
    entry.total += Number(e.amount);
    entry.count += 1;
    dailyMap.set(day, entry);
  }
  const dailyTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, count }]) => ({ date, total, count }));

  const totalExpenses = Number(totalResult._sum.amount ?? 0);
  const categoryCount = byCategory.length;
  const daysInRange = dailyTrend.length || 1;
  const dailyAvg = totalExpenses / daysInRange;

  return apiSuccess({
    summary: { totalExpenses, categoryCount, dailyAvg },
    byCategory: byCategory.map((c) => ({
      category: categoryMap.get(c.categoryId!) ?? "Unknown",
      count: c._count,
      total: Number(c._sum.amount ?? 0),
    })),
    dailyTrend,
  });
});
