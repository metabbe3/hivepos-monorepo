import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { UNPAID_PAYMENT_STATUSES } from "@/lib/constants";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const DAY_NAMES_ID = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "read");
  const { branchIds } = ctx;

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

  // Selected month date range
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const receivedAtFilter = {
    OR: [
      { receivedAt: { gte: monthStart, lte: monthEnd } },
      { receivedAt: null, createdAt: { gte: monthStart, lte: monthEnd } },
    ],
  };

  // --- Month data ---
  const [kgItems, itemItems, unpaidOrders, expensesByCategory, expenseDetails, dailyOrders, cashPayments] = await Promise.all([
    // Per-KG income
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: {
        order: { ...receivedAtFilter, branchId: { in: branchIds } },
        service: { pricingType: "PER_KG" },
      },
      _sum: { subtotal: true },
    }),
    // Per-Item income
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: {
        order: { ...receivedAtFilter, branchId: { in: branchIds } },
        service: { pricingType: "PER_ITEM" },
      },
      _sum: { subtotal: true },
    }),
    // Unpaid balance
    prisma.order.findMany({
      where: {
        ...receivedAtFilter,
        branchId: { in: branchIds },
        paymentStatus: { in: UNPAID_PAYMENT_STATUSES },
      },
      select: { totalAmount: true, paidAmount: true },
    }),
    // Expenses by category
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { branchId: { in: branchIds }, date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    // Expense details
    prisma.expense.findMany({
      where: { branchId: { in: branchIds }, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true, description: true, amount: true, category: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    // Daily order details
    prisma.order.findMany({
      where: { ...receivedAtFilter, branchId: { in: branchIds } },
      include: {
        customer: { select: { name: true } },
        orderItems: { include: { service: { select: { name: true, pricingType: true } } } },
      },
      orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    }),
    // Cash collected this month (by payment date) — cash-flow memo; includes
    // late payments of prior months' piutang. NOT added to accrual income.
    prisma.payment.findMany({
      where: {
        paidAt: { gte: monthStart, lte: monthEnd },
        order: { branchId: { in: branchIds } },
      },
      // order date needed to break cash down by originating month
      select: { amount: true, order: { select: { receivedAt: true, createdAt: true } } },
    }),
  ]);

  const perKg = kgItems.reduce((sum, i) => sum + Number(i._sum.subtotal ?? 0), 0);
  const perItem = itemItems.reduce((sum, i) => sum + Number(i._sum.subtotal ?? 0), 0);
  const totalIncome = perKg + perItem;
  const unpaidBalance = unpaidOrders.reduce((sum, o) => sum + Number(o.totalAmount) - Number(o.paidAmount), 0);
  const cashCollected = cashPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  // Breakdown by originating order's month (receivedAt ?? createdAt — same basis
  // as income) so "bulan ini" matches the income definition. Cash from prior
  // months' orders = late piutang collections.
  const currentMonthKey = `${year}-${String(month).padStart(2, "0")}`;
  const cashByOrigin = new Map<string, number>();
  for (const p of cashPayments) {
    const d = p.order.receivedAt ?? p.order.createdAt;
    const key = d.toISOString().slice(0, 7);
    cashByOrigin.set(key, (cashByOrigin.get(key) ?? 0) + Number(p.amount));
  }
  const cashCollectedByMonth = Array.from(cashByOrigin.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([m, amount]) => ({ month: m, amount, isCurrent: m === currentMonthKey }));

  // Resolve expense category names
  const categoryIds = (expensesByCategory.map((e) => e.categoryId).filter(Boolean) as string[]);
  const categories = categoryIds.length > 0
    ? await prisma.expenseCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const expenses = expensesByCategory.map((e) => ({
    category: categoryMap.get(e.categoryId!) ?? "Lainnya",
    amount: Number(e._sum.amount ?? 0),
  }));
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const marginPercent = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 10000) / 100 : 0;

  // --- Annual comparison ---
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const [yearOrders, yearExpenses] = await Promise.all([
    prisma.order.findMany({
      where: {
        branchId: { in: branchIds },
        OR: [
          { receivedAt: { gte: yearStart, lte: yearEnd } },
          { receivedAt: null, createdAt: { gte: yearStart, lte: yearEnd } },
        ],
      },
      select: {
        totalAmount: true,
        discountAmount: true,
        receivedAt: true,
        createdAt: true,
        orderItems: { select: { subtotal: true, service: { select: { pricingType: true } } } },
      },
    }),
    prisma.expense.findMany({
      where: { branchId: { in: branchIds }, date: { gte: yearStart, lte: yearEnd } },
      select: { date: true, amount: true },
    }),
  ]);

  // Build monthly aggregates
  const monthlyData: Record<number, { revenue: number; expenses: number }> = {};
  for (let m = 1; m <= 12; m++) monthlyData[m] = { revenue: 0, expenses: 0 };

  for (const o of yearOrders) {
    const d = new Date(o.receivedAt ?? o.createdAt);
    const m = d.getMonth() + 1;
    if (d.getFullYear() === year && monthlyData[m]) {
      monthlyData[m].revenue += Number(o.totalAmount) - Number(o.discountAmount ?? 0);
    }
  }

  for (const e of yearExpenses) {
    const d = new Date(e.date);
    const m = d.getMonth() + 1;
    if (d.getFullYear() === year && monthlyData[m]) {
      monthlyData[m].expenses += Number(e.amount);
    }
  }

  const annualComparison = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const rev = monthlyData[m].revenue;
    const exp = monthlyData[m].expenses;
    return {
      month: m,
      monthName: MONTH_NAMES_ID[i],
      revenue: rev,
      expenses: exp,
      netProfit: rev - exp,
    };
  });

  // --- Daily transactions ---
  const dayMap = new Map<string, typeof dailyOrders>();
  for (const o of dailyOrders) {
    const d = new Date((o as any).receivedAt ?? o.createdAt);
    const key = d.toISOString().slice(0, 10);
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(o);
  }

  const dailyTransactions = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, orders]) => {
      const d = new Date(date + "T00:00:00");
      const dayName = DAY_NAMES_ID[d.getDay()];
      const dateNumber = d.getDate();
      const dayTotal = orders.reduce((s, o) => s + Number(o.totalAmount), 0);

      const orderDetails = orders.map((o) => {
        let weightKg = 0;
        const items: { name: string; qty: number }[] = [];
        for (const item of o.orderItems) {
          if (item.service.pricingType === "PER_KG") {
            weightKg += Number(item.weightKg ?? 0);
          } else {
            items.push({ name: item.service.name, qty: Number(item.quantity ?? 0) });
          }
        }
        const itemSummary = items.map((i) => `${i.name} x${i.qty}`).join(", ");
        return {
          customerName: o.customer.name,
          weightKg: Math.round(weightKg * 100) / 100,
          items,
          itemSummary,
          amount: Number(o.totalAmount),
        };
      });

      return { date, dayName, dateNumber, orders: orderDetails, dayTotal, runningTotal: 0 };
    });

  // Add running totals
  let runningTotal = 0;
  for (const day of dailyTransactions) {
    runningTotal += day.dayTotal;
    day.runningTotal = runningTotal;
  }

  return apiSuccess({
    month,
    year,
    monthName: MONTH_NAMES_ID[month - 1],
    pnl: {
      income: { perKg, perItem, total: totalIncome },
      unpaidBalance,
      cashCollected,
      cashCollectedByMonth,
      expenses,
      totalExpenses,
      netProfit,
      marginPercent,
    },
    expenseDetails: expenseDetails.map((e) => ({
      date: e.date.toISOString().slice(0, 10),
      description: e.description || (e.category?.name || "Uncategorized"),
      amount: Number(e.amount),
    })),
    dailyTransactions,
    annualComparison,
  });
});
