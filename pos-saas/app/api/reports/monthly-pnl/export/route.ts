import { NextResponse } from "next/server";
import { UNPAID_PAYMENT_STATUSES } from "@/lib/constants";
import { withErrorHandler } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const MONTH_SHORT = ["JAN", "FEB", "MRT", "APR", "MEI", "JUN", "JUL", "AGS", "SEP", "OCT", "NOV", "DES"];
const DAY_NAMES_ID = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "export");
  const { branchIds } = ctx;

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const receivedAtFilter = {
    OR: [
      { receivedAt: { gte: monthStart, lte: monthEnd } },
      { receivedAt: null, createdAt: { gte: monthStart, lte: monthEnd } },
    ],
  };

  // Fetch data (same as main endpoint)
  const [kgItems, itemItems, unpaidOrders, expensesByCategory, expenseDetails, dailyOrders] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: { order: { ...receivedAtFilter, branchId: { in: branchIds } }, service: { pricingType: "PER_KG" } },
      _sum: { subtotal: true },
    }),
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: { order: { ...receivedAtFilter, branchId: { in: branchIds } }, service: { pricingType: "PER_ITEM" } },
      _sum: { subtotal: true },
    }),
    prisma.order.findMany({
      where: { ...receivedAtFilter, branchId: { in: branchIds }, paymentStatus: { in: UNPAID_PAYMENT_STATUSES } },
      select: { totalAmount: true, paidAmount: true },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { branchId: { in: branchIds }, date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.expense.findMany({
      where: { branchId: { in: branchIds }, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true, description: true, amount: true, category: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    // Daily orders for transaction sheet
    prisma.order.findMany({
      where: { ...receivedAtFilter, branchId: { in: branchIds } },
      include: {
        customer: { select: { name: true } },
        orderItems: { include: { service: { select: { name: true, pricingType: true } } } },
      },
      orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const perKg = kgItems.reduce((s, i) => s + Number(i._sum.subtotal ?? 0), 0);
  const perItem = itemItems.reduce((s, i) => s + Number(i._sum.subtotal ?? 0), 0);
  const totalIncome = perKg + perItem;
  const unpaidBalance = unpaidOrders.reduce((s, o) => s + Number(o.totalAmount) - Number(o.paidAmount), 0);

  const categoryIds = (expensesByCategory.map((e) => e.categoryId).filter(Boolean) as string[]);
  const categories = categoryIds.length > 0
    ? await prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : [];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const expenses = expensesByCategory.map((e) => ({ category: categoryMap.get(e.categoryId!) ?? "Lainnya", amount: Number(e._sum.amount ?? 0) }));
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  // Annual comparison
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const [yearOrders, yearExpenses] = await Promise.all([
    prisma.order.findMany({
      where: { branchId: { in: branchIds }, OR: [{ receivedAt: { gte: yearStart, lte: yearEnd } }, { receivedAt: null, createdAt: { gte: yearStart, lte: yearEnd } }] },
      select: { totalAmount: true, discountAmount: true, receivedAt: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { branchId: { in: branchIds }, date: { gte: yearStart, lte: yearEnd } },
      select: { date: true, amount: true },
    }),
  ]);

  const monthlyData: Record<number, { revenue: number; expenses: number }> = {};
  for (let m = 1; m <= 12; m++) monthlyData[m] = { revenue: 0, expenses: 0 };

  for (const o of yearOrders) {
    const d = new Date(o.receivedAt ?? o.createdAt);
    const m = d.getMonth() + 1;
    if (d.getFullYear() === year) monthlyData[m].revenue += Number(o.totalAmount) - Number(o.discountAmount ?? 0);
  }
  for (const e of yearExpenses) {
    const d = new Date(e.date);
    const m = d.getMonth() + 1;
    if (d.getFullYear() === year) monthlyData[m].expenses += Number(e.amount);
  }

  // --- Build XLSX ---
  const monthLabel = `${MONTH_NAMES_ID[month - 1]} ${year}`.toUpperCase();
  const sheetName = `RL ${MONTH_SHORT[month - 1]}${String(year).slice(2)}`;

  // Sheet 1: RL [MONTH]
  const rows: (string | number)[][] = [];

  rows.push([]);
  rows.push(["LAPORAN RUGI LABA HIVEPOS"]);
  rows.push([monthLabel, "", "", totalIncome]);
  rows.push([]);
  rows.push(["PEMASUKAN"]);
  rows.push(["", "- KILOAN", "", perKg]);
  rows.push(["", "- SATUAN", "", perItem]);
  rows.push(["", "", "", totalIncome]);
  rows.push(["", "DI DANA"]);
  rows.push(["", "BELUM DIBAYAR", "", unpaidBalance]);
  rows.push([]);
  rows.push([]);
  rows.push(["PENGELUARAN"]);
  rows.push(["", "BIAYA OPERASIONAL"]);

  for (const e of expenses) {
    rows.push(["", `  - ${e.category.toUpperCase()}`, "", e.amount]);
  }
  rows.push(["", "", "", totalExpenses]);
  rows.push([]);
  rows.push([]);
  rows.push(["LABA / RUGI", "", "", netProfit]);
  rows.push([]);

  // Expense details
  for (const e of expenseDetails) {
    rows.push([e.date.toISOString().slice(0, 10), e.description || e.category?.name || "Uncategorized", Number(e.amount)]);
  }

  // Annual comparison section
  rows.push([]);
  rows.push([]);
  rows.push(["", "", "PEMBAGIAN", "OMZET", "R/L"]);
  rows.push([]);

  let totalOmzet = 0;
  let totalRL = 0;
  for (let m = 1; m <= 12; m++) {
    const rev = monthlyData[m].revenue;
    const exp = monthlyData[m].expenses;
    const profit = rev - exp;
    const omzet = rev > 0 ? Math.round(profit * 0.13) : 0;
    totalOmzet += omzet;
    totalRL += profit;
    rows.push(["", MONTH_NAMES_ID[m - 1].toUpperCase(), omzet, rev, profit]);
  }
  rows.push([]);
  rows.push(["", "", totalOmzet, yearOrders.length > 0 ? monthlyData[1].revenue + monthlyData[2].revenue + monthlyData[3].revenue + monthlyData[4].revenue + monthlyData[5].revenue + monthlyData[6].revenue + monthlyData[7].revenue + monthlyData[8].revenue + monthlyData[9].revenue + monthlyData[10].revenue + monthlyData[11].revenue + monthlyData[12].revenue : 0, totalRL]);

  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 15 }];

  // Sheet 2: PERBANDINGAN
  const compRows: (string | number)[][] = [];
  compRows.push(["PERBANDINGAN BULANAN", year]);
  compRows.push([]);
  compRows.push(["Bulan", "Pendapatan", "Pengeluaran", "Laba/Rugi"]);
  let totRev = 0, totExp = 0, totProfit = 0;
  for (let m = 1; m <= 12; m++) {
    const rev = monthlyData[m].revenue;
    const exp = monthlyData[m].expenses;
    const profit = rev - exp;
    totRev += rev;
    totExp += exp;
    totProfit += profit;
    compRows.push([MONTH_NAMES_ID[m - 1], rev, exp, profit]);
  }
  compRows.push([]);
  compRows.push(["TOTAL", totRev, totExp, totProfit]);

  const ws2 = XLSX.utils.aoa_to_sheet(compRows);
  ws2["!cols"] = [{ wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

  // Sheet 3: Daily transaction log
  const txSheetName = `${MONTH_SHORT[month - 1]}${String(year).slice(2)}`;
  const txRows: (string | number)[][] = [];
  txRows.push(["HIVEPOS"]);
  txRows.push([monthLabel]);
  txRows.push([]);
  txRows.push(["HARI", "TGL", "NAMA", "KILOAN (KG)", "SATUAN", "", "JUMLAH", "TOTAL", "KUMULATIF", "KETERANGAN"]);
  txRows.push(["", "", "", "", "item", "qty", "", "", "", ""]);

  // Group orders by day
  const dayMap = new Map<string, typeof dailyOrders>();
  for (const o of dailyOrders) {
    const d = new Date((o as any).receivedAt ?? o.createdAt);
    const key = d.toISOString().slice(0, 10);
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(o);
  }

  let cumTotal = 0;
  const sortedDays = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  for (const [dateStr, dayOrders] of sortedDays) {
    const d = new Date(dateStr + "T00:00:00");
    const dayName = DAY_NAMES_ID[d.getDay()];
    const dateNum = d.getDate();
    let dayTotal = 0;

    for (let i = 0; i < dayOrders.length; i++) {
      const o = dayOrders[i];
      let weightKg = 0;
      const itemNames: string[] = [];
      const itemQtys: (string | number)[] = [];
      for (const item of o.orderItems) {
        if (item.service.pricingType === "PER_KG") {
          weightKg += Number(item.weightKg ?? 0);
        } else {
          itemNames.push(item.service.name);
          itemQtys.push(Number(item.quantity ?? 0));
        }
      }
      const amount = Number(o.totalAmount);
      dayTotal += amount;
      const isLast = i === dayOrders.length - 1;

      txRows.push([
        i === 0 ? dayName : "",
        i === 0 ? dateNum : "",
        o.customer.name,
        weightKg > 0 ? Math.round(weightKg * 100) / 100 : "",
        itemNames.join(", ") || "-",
        itemQtys.join(", ") || "",
        amount,
        isLast ? dayTotal : "",
        isLast ? (cumTotal + dayTotal) : "",
        o.orderItems.map((it) => it.service.name).join(", "),
      ]);
    }
    cumTotal += dayTotal;
  }

  // Total row
  txRows.push([]);
  txRows.push(["", "", "TOTAL", "", "", "", "", cumTotal, cumTotal]);

  const ws3 = XLSX.utils.aoa_to_sheet(txRows);
  ws3["!cols"] = [{ wch: 10 }, { wch: 5 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, sheetName);
  XLSX.utils.book_append_sheet(wb, ws2, "PERBANDINGAN");
  XLSX.utils.book_append_sheet(wb, ws3, txSheetName);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  // Binary XLSX response — cast to satisfy withErrorHandler's SuccessEnvelope<T>
  // type signature. At runtime the wrapper simply returns whatever the handler
  // returns, so the raw XLSX buffer passes through unchanged.
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="RL_${MONTH_SHORT[month - 1]}${year}.xlsx"`,
    },
  }) as never;
});
