import { NextResponse } from "next/server";
import { withErrorHandler } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { BUSINESS_NAME_KEY, UNPAID_PAYMENT_STATUSES } from "@/lib/constants";

const BUSINESS_NAME_FALLBACK = "hivePOS";
import { buildDateFilter, formatCurrency } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "export");
  const { branchIds } = ctx;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "revenue";
  const fromStr = searchParams.get("from") || "";
  const toStr = searchParams.get("to") || "";

  const { where, hasFilter, dateFilter } = buildDateFilter(fromStr, toStr);

  const doc = new jsPDF();
  // Fetch branch name for the report title
  const branches = await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { name: true } });
  const businessName = branches.length > 1 ? "Semua Outlet" : (branches[0]?.name || BUSINESS_NAME_FALLBACK);
  const title = `${businessName} — ${type.charAt(0).toUpperCase() + type.slice(1)} Report`;
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  const periodLabel = fromStr || toStr ? `${fromStr || "All"} to ${toStr || "Present"}` : "All time";
  doc.text(`Period: ${periodLabel}`, 14, 30);
  doc.text(`Generated: ${new Date().toLocaleString("id-ID")}`, 14, 36);

  switch (type) {
    case "revenue":
      await buildRevenuePdf(doc, where, dateFilter, branchIds);
      break;
    case "orders":
      await buildOrdersPdf(doc, where, dateFilter, branchIds);
      break;
    case "customers":
      await buildCustomersPdf(doc, where, branchIds);
      break;
    case "services":
      await buildServicesPdf(doc, where, dateFilter, branchIds);
      break;
    case "commission":
      await buildCommissionPdf(doc, dateFilter, branchIds);
      break;
    case "outstanding":
      await buildOutstandingPdf(doc, where, branchIds);
      break;
    case "expenses":
      await buildExpensesPdf(doc, dateFilter, branchIds);
      break;
    case "profit":
      await buildProfitPdf(doc, where, dateFilter, branchIds);
      break;
    case "inventory":
      await buildInventoryPdf(doc, dateFilter, branchIds);
      break;
    case "payment-collection":
      await buildPaymentCollectionPdf(doc, dateFilter, hasFilter, fromStr, branchIds);
      break;
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  // Binary PDF response — cast to satisfy withErrorHandler's SuccessEnvelope<T>
  // type signature. At runtime the wrapper simply returns whatever the handler
  // returns, so the raw PDF buffer passes through unchanged.
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${type}-report-${fromStr}-to-${toStr}.pdf"`,
    },
  }) as never;
});

async function buildRevenuePdf(doc: jsPDF, where: object, dateFilter: { gte?: Date; lte?: Date }, branchIds: string[]) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const paymentWhere = hasDateFilter ? { order: { ...where, branchId: { in: branchIds } } } : { order: { branchId: { in: branchIds } } };

  const [agg, paymentsByMethod] = await Promise.all([
    prisma.order.aggregate({
      where: { ...where, branchId: { in: branchIds } },
      _count: true,
      _sum: { totalAmount: true, discountAmount: true, paidAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: paymentWhere,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Summary section
  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Gross Revenue", formatCurrency(Number(agg._sum.totalAmount ?? 0))],
      ["Discounts", formatCurrency(Number(agg._sum.discountAmount ?? 0))],
      ["Net Revenue", formatCurrency(Number(agg._sum.totalAmount ?? 0) - Number(agg._sum.discountAmount ?? 0))],
      ["Total Paid", formatCurrency(Number(agg._sum.paidAmount ?? 0))],
      ["Orders", String(agg._count)],
    ],
    theme: "grid",
    headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [255, 251, 235] },
  });

  // Payment methods
  if (paymentsByMethod.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastY = (doc as any).lastAutoTable?.finalY ?? 120;
    autoTable(doc, {
      startY: lastY + 10,
      head: [["Payment Method", "Count", "Total"]],
      body: paymentsByMethod.map((p) => [p.paymentMethod, String(p._count), formatCurrency(Number(p._sum.amount ?? 0))]),
      theme: "grid",
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 4 },
      alternateRowStyles: { fillColor: [255, 251, 235] },
    });
  }
}

async function buildOrdersPdf(doc: jsPDF, where: object, dateFilter: { gte?: Date; lte?: Date }, branchIds: string[]) {
  const [statusGroups, deliveredOrders, totalOrders] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { ...where, branchId: { in: branchIds } }, _count: true, _sum: { totalAmount: true } }),
    prisma.order.findMany({ where: { ...where, deliveredAt: { not: null }, branchId: { in: branchIds } }, select: { createdAt: true, deliveredAt: true } }),
    prisma.order.count({ where: { ...where, branchId: { in: branchIds } } }),
  ]);

  const turnaroundHours = deliveredOrders.map((o) => (o.deliveredAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60));
  const avgTurnaround = turnaroundHours.length > 0 ? Math.round((turnaroundHours.reduce((a, b) => a + b, 0) / turnaroundHours.length) * 10) / 10 : null;

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Orders", String(totalOrders)],
      ["Avg Turnaround (hours)", avgTurnaround !== null ? String(avgTurnaround) : "N/A"],
      ["Delivered", String(turnaroundHours.length)],
    ],
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [239, 246, 255] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable?.finalY ?? 100;
  autoTable(doc, {
    startY: lastY + 10,
    head: [["Status", "Count", "Total Amount"]],
    body: statusGroups.map((s) => [s.status, String(s._count), formatCurrency(Number(s._sum.totalAmount ?? 0))]),
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [239, 246, 255] },
  });
}

async function buildCustomersPdf(doc: jsPDF, where: object, branchIds: string[]) {
  const [totalCustomers, newCount, topSpenders] = await Promise.all([
    prisma.customer.count({ where: { branchId: { in: branchIds } } }),
    prisma.customer.count({ where: { ...where, branchId: { in: branchIds } } }),
    prisma.order.groupBy({
      by: ["customerId"], where: { ...where, branchId: { in: branchIds } },
      _sum: { totalAmount: true }, _count: true,
      orderBy: { _sum: { totalAmount: "desc" } }, take: 20,
    }),
  ]);

  const spenderIds = topSpenders.map((s) => s.customerId);
  const spenderCustomers = spenderIds.length > 0
    ? await prisma.customer.findMany({ where: { id: { in: spenderIds }, branchId: { in: branchIds } }, select: { id: true, name: true } })
    : [];
  const spenderMap = new Map(spenderCustomers.map((c) => [c.id, c.name]));

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Customers", String(totalCustomers)],
      ["New in Period", String(newCount)],
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
  });

  if (topSpenders.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable?.finalY ?? 100;
    autoTable(doc, {
      startY: lastY + 10,
      head: [["#", "Customer", "Orders", "Total Spent"]],
      body: topSpenders.map((s, i) => [
        String(i + 1),
        spenderMap.get(s.customerId) ?? "Unknown",
        String(s._count),
        formatCurrency(Number(s._sum.totalAmount ?? 0)),
      ]),
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 4 },
      alternateRowStyles: { fillColor: [236, 253, 245] },
    });
  }
}

async function buildServicesPdf(doc: jsPDF, where: object, dateFilter: { gte?: Date; lte?: Date }, branchIds: string[]) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const itemWhere = hasDateFilter ? { order: { ...where, branchId: { in: branchIds } } } : { order: { branchId: { in: branchIds } } };

  const [serviceGroups, allServices] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["serviceId"], where: itemWhere,
      _sum: { quantity: true, weightKg: true, subtotal: true }, _count: true,
      orderBy: { _sum: { subtotal: "desc" } },
    }),
    prisma.service.findMany({ where: { isActive: true, branchId: { in: branchIds } }, select: { id: true, name: true } }),
  ]);

  const serviceMap = new Map(allServices.map((s) => [s.id, s.name]));

  autoTable(doc, {
    startY: 44,
    head: [["Service", "Orders", "Revenue", "Avg Value"]],
    body: serviceGroups.map((g) => [
      serviceMap.get(g.serviceId) ?? "Unknown",
      String(g._count),
      formatCurrency(Number(g._sum.subtotal ?? 0)),
      formatCurrency(g._count > 0 ? Number(g._sum.subtotal ?? 0) / g._count : 0),
    ]),
    theme: "grid",
    headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [245, 243, 255] },
  });
}

async function buildCommissionPdf(doc: jsPDF, dateFilter: { gte?: Date; lte?: Date }, branchIds: string[]) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const dateWhere = hasDateFilter ? { OR: [{ receivedAt: dateFilter }, { receivedAt: null, createdAt: dateFilter }] } : {};
  const itemWhere = hasDateFilter ? { order: { ...dateWhere, branchId: { in: branchIds } } } : { order: { branchId: { in: branchIds } } };

  const [serviceGroups, allServices] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["serviceId"], where: itemWhere,
      _sum: { quantity: true, weightKg: true, subtotal: true }, _count: true,
    }),
    prisma.service.findMany({ where: { branchId: { in: branchIds } }, select: { id: true, name: true, pricingType: true, commissionType: true, commissionValue: true } }),
  ]);

  const serviceMap = new Map(allServices.map((s) => [s.id, s]));

  const rows = serviceGroups.map((g) => {
    const svc = serviceMap.get(g.serviceId);
    const revenue = Number(g._sum.subtotal ?? 0);
    const totalWeightKg = Number(g._sum.weightKg ?? 0);
    const totalQty = Number(g._sum.quantity ?? 0);
    const commType = svc?.commissionType ?? "NONE";
    const commValue = Number(svc?.commissionValue ?? 0);

    let commission = 0;
    if (commType === "FLAT") {
      commission = svc?.pricingType === "PER_KG" ? commValue * totalWeightKg : commValue * totalQty;
    } else if (commType === "PERCENTAGE") {
      commission = revenue * (commValue / 100);
    }

    return [
      svc?.name ?? "Unknown",
      String(g._count),
      formatCurrency(revenue),
      commType === "NONE" ? "—" : commType === "FLAT" ? formatCurrency(commValue) : `${commValue}%`,
      formatCurrency(Math.round(commission)),
    ];
  });

  autoTable(doc, {
    startY: 44,
    head: [["Service", "Orders", "Revenue", "Commission", "Earned"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
  });
}

async function buildOutstandingPdf(doc: jsPDF, where: object, branchIds: string[]) {
  const outstandingOrders = await prisma.order.findMany({
    where: { paymentStatus: { in: UNPAID_PAYMENT_STATUSES }, ...where, branchId: { in: branchIds } },
    select: {
      totalAmount: true, paidAmount: true, createdAt: true,
      customer: { select: { name: true, phone: true } },
    },
  });

  const customerMap = new Map<string, { name: string; phone: string; totalOutstanding: number; orderCount: number }>();
  for (const o of outstandingOrders) {
    const outstanding = Number(o.totalAmount) - Number(o.paidAmount);
    const existing = customerMap.get(o.customer.name);
    if (existing) {
      existing.totalOutstanding += outstanding;
      existing.orderCount++;
    } else {
      customerMap.set(o.customer.name, { name: o.customer.name, phone: o.customer.phone ?? "", totalOutstanding: outstanding, orderCount: 1 });
    }
  }

  const rows = Array.from(customerMap.values())
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    .map((c) => [c.name, c.phone, formatCurrency(c.totalOutstanding), String(c.orderCount)]);

  autoTable(doc, {
    startY: 44,
    head: [["Customer", "Phone", "Outstanding", "Orders"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [254, 242, 242] },
  });
}

async function buildExpensesPdf(doc: jsPDF, dateFilter: { gte?: Date; lte?: Date }, branchIds: string[]) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const expenseWhere: Record<string, unknown> = { branchId: { in: branchIds } };
  if (hasDateFilter) expenseWhere.date = dateFilter;

  const [expenses, categories] = await Promise.all([
    prisma.expense.findMany({
      where: expenseWhere,
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    prisma.expenseCategory.findMany({ where: { branchId: { in: branchIds } } }),
  ]);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Summary
  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Expenses", formatCurrency(totalExpenses)],
      ["Categories", String(categories.length)],
      ["Entries", String(expenses.length)],
    ],
    theme: "grid",
    headStyles: { fillColor: [244, 63, 94], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [255, 241, 242] },
  });

  // By category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY1 = (doc as any).lastAutoTable?.finalY ?? 100;
  const categoryMap = new Map<string, { name: string; total: number; count: number }>();
  for (const e of expenses) {
    const catName = e.category?.name ?? "Unknown";
    const existing = categoryMap.get(catName);
    if (existing) {
      existing.total += Number(e.amount);
      existing.count++;
    } else {
      categoryMap.set(catName, { name: catName, total: Number(e.amount), count: 1 });
    }
  }

  autoTable(doc, {
    startY: lastY1 + 10,
    head: [["Category", "Entries", "Total"]],
    body: Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total)
      .map((c) => [c.name, String(c.count), formatCurrency(c.total)]),
    theme: "grid",
    headStyles: { fillColor: [244, 63, 94], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [255, 241, 242] },
  });
}

async function buildProfitPdf(doc: jsPDF, where: object, dateFilter: { gte?: Date; lte?: Date }, branchIds: string[]) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const expenseWhere: Record<string, unknown> = { branchId: { in: branchIds } };
  if (hasDateFilter) expenseWhere.date = dateFilter;

  const [revenueAgg, totalExpenses] = await Promise.all([
    prisma.order.aggregate({
      where: { ...where, branchId: { in: branchIds } },
      _sum: { totalAmount: true, discountAmount: true },
    }),
    prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    }),
  ]);

  const revenue = Number(revenueAgg._sum.totalAmount ?? 0);
  const discount = Number(revenueAgg._sum.discountAmount ?? 0);
  const netRevenue = revenue - discount;
  const expenses = Number(totalExpenses._sum.amount ?? 0);
  const profit = netRevenue - expenses;
  const margin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Revenue", formatCurrency(revenue)],
      ["Discounts", formatCurrency(discount)],
      ["Net Revenue", formatCurrency(netRevenue)],
      ["Total Expenses", formatCurrency(expenses)],
      ["Net Profit", formatCurrency(profit)],
      ["Margin", `${margin.toFixed(1)}%`],
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
  });
}

async function buildInventoryPdf(doc: jsPDF, dateFilter: { gte?: Date; lte?: Date }, branchIds: string[]) {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const movementWhere: Record<string, unknown> = {};
  if (hasDateFilter) movementWhere.date = dateFilter;

  const [stockItems, movements] = await Promise.all([
    prisma.stockItem.findMany({
      where: { isActive: true, branchId: { in: branchIds } },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { stockItem: { branchId: { in: branchIds } }, ...movementWhere },
      include: { stockItem: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 50,
    }),
  ]);

  const totalValue = stockItems.reduce(
    (sum, i) => sum + Number(i.currentQuantity) * Number(i.purchasePricePerUnit), 0
  );
  const lowStockCount = stockItems.filter(
    (i) => Number(i.currentQuantity) <= Number(i.lowStockThreshold)
  ).length;
  const inMovements = movements.filter((m) => m.type === "IN").length;

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Items", String(stockItems.length)],
      ["Total Value", formatCurrency(totalValue)],
      ["Low Stock Items", String(lowStockCount)],
      ["Stock In (Period)", String(inMovements)],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [240, 253, 250] },
  });

  // Stock levels table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable?.finalY ?? 120;
  autoTable(doc, {
    startY: lastY + 10,
    head: [["Item", "Unit", "Quantity", "Threshold", "Value"]],
    body: stockItems.map((i) => [
      i.name,
      i.unit,
      String(Number(i.currentQuantity)),
      String(Number(i.lowStockThreshold)),
      formatCurrency(Number(i.currentQuantity) * Number(i.purchasePricePerUnit)),
    ]),
    theme: "grid",
    headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [240, 253, 250] },
  });
}

async function buildPaymentCollectionPdf(
  doc: jsPDF,
  dateFilter: { gte?: Date; lte?: Date },
  hasFilter: boolean,
  fromStr: string,
  branchIds: string[],
) {
  const paymentDateFilter: { gte?: Date; lte?: Date } = {};
  if (hasFilter) {
    if (dateFilter.gte) paymentDateFilter.gte = dateFilter.gte;
    if (dateFilter.lte) paymentDateFilter.lte = dateFilter.lte;
  }
  const orderCreatedBefore: { lt?: Date } = {};
  if (fromStr) orderCreatedBefore.lt = new Date(fromStr);

  const [paymentsFromOldOrders, unpaidOrders] = await Promise.all([
    prisma.payment.findMany({
      where: {
        ...(hasFilter ? { createdAt: paymentDateFilter } : {}),
        order: {
          ...(fromStr ? { createdAt: orderCreatedBefore } : {}),
          branchId: { in: branchIds },
        },
      },
      select: {
        amount: true,
        createdAt: true,
        order: {
          select: {
            createdAt: true,
            orderNumber: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: { paymentStatus: { in: UNPAID_PAYMENT_STATUSES }, branchId: { in: branchIds } },
      select: {
        orderNumber: true,
        totalAmount: true,
        paidAmount: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalCollected = paymentsFromOldOrders.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOutstanding = unpaidOrders.reduce(
    (sum, o) => sum + (Number(o.totalAmount) - Number(o.paidAmount)),
    0,
  );

  // Summary table
  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Collected This Period (old orders)", formatCurrency(totalCollected)],
      ["Unpaid Orders", String(unpaidOrders.length)],
      ["Total Outstanding", formatCurrency(totalOutstanding)],
    ],
    theme: "grid",
    headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
  });

  // Payments by order month
  const monthKey = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const paymentMonthMap = new Map<string, { count: number; total: number }>();
  for (const p of paymentsFromOldOrders) {
    const mk = monthKey(p.order.createdAt);
    const existing = paymentMonthMap.get(mk);
    if (existing) {
      existing.count++;
      existing.total += Number(p.amount);
    } else {
      paymentMonthMap.set(mk, { count: 1, total: Number(p.amount) });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY1 = (doc as any).lastAutoTable?.finalY ?? 120;
  autoTable(doc, {
    startY: lastY1 + 10,
    head: [["Order Month", "Payments", "Collected"]],
    body: Array.from(paymentMonthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, data]) => [month, String(data.count), formatCurrency(data.total)]),
    theme: "grid",
    headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
  });

  // Aged unpaid orders — grouped by creation month
  const unpaidMonthMap = new Map<string, { count: number; total: number }>();
  for (const order of unpaidOrders) {
    const outstanding = Number(order.totalAmount) - Number(order.paidAmount);
    const orderDate = new Date(order.createdAt);
    const mk = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
    const existing = unpaidMonthMap.get(mk);
    if (existing) {
      existing.count++;
      existing.total += outstanding;
    } else {
      unpaidMonthMap.set(mk, { count: 1, total: outstanding });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY2 = (doc as any).lastAutoTable?.finalY ?? 180;
  autoTable(doc, {
    startY: lastY2 + 10,
    head: [["Order Month", "Orders", "Outstanding"]],
    body: Array.from(unpaidMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => [month, String(data.count), formatCurrency(data.total)]),
    theme: "grid",
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    alternateRowStyles: { fillColor: [254, 242, 242] },
  });
}
