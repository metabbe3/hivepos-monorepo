// ponytail: xlsx (~400KB) loaded only when user actually exports to .xlsx.
// Static import would bundle it with every page that touches export-utils.

export function exportToCsv(data: Record<string, unknown>[], filename: string, headers?: Record<string, string>) {
  if (data.length === 0) return;
  const keys = Object.keys(data[0]);
  const headerRow = keys.map((k) => headers?.[k] ?? k).join(",");
  const rows = data.map((row) =>
    keys.map((k) => {
      const val = row[k];
      const str = String(val ?? "");
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  const csv = [headerRow, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

export async function exportToXls(data: Record<string, unknown>[], filename: string, sheetName = "Report", headers?: Record<string, string>) {
  if (data.length === 0) return;
  const XLSX = await import("xlsx");
  const keys = Object.keys(data[0]);
  const headerRow: Record<string, string> = {};
  keys.forEach((k) => { headerRow[k] = headers?.[k] ?? k; });
  const displayData = [headerRow, ...data];
  const ws = XLSX.utils.json_to_sheet(displayData, { skipHeader: true });
  ws["!cols"] = keys.map((k) => ({ wch: Math.max((headers?.[k] ?? k).length, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function exportToPdf(type: string, from: string, to: string) {
  window.open(`/api/reports/export?type=${type}&from=${from}&to=${to}`, "_blank");
}

export async function exportAllToXlsx(from: string, to: string, t: (key: string) => string) {
  const endpoints = [
    "revenue", "orders", "expenses", "profit", "customers", "services", "outstanding",
  ] as const;

  // Report routes return the { success, data } envelope (apiSuccess). Unwrap
  // .data here so responses[i] is the payload itself (or null on failure) —
  // otherwise rev.dailyTrend etc. are undefined and .map() throws.
  const responses = await Promise.all(
    endpoints.map((ep) =>
      fetch(`/api/reports/${ep}?from=${from}&to=${to}`)
        .then((r) => r.json())
        .then((j: { success?: boolean; data?: unknown }) => (j?.success ? j.data : null))
        .catch(() => null)
    )
  );

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  function addSheet(name: string, data: Record<string, unknown>[], headers: Record<string, string>) {
    if (data.length === 0) return;
    const keys = Object.keys(data[0]);
    const headerRow: Record<string, string> = {};
    keys.forEach((k) => { headerRow[k] = headers[k] ?? k; });
    const displayData = [headerRow, ...data];
    const ws = XLSX.utils.json_to_sheet(displayData, { skipHeader: true });
    ws["!cols"] = keys.map((k) => ({ wch: Math.max((headers[k] ?? k).length * 1.5, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }

  // 1. Revenue
  const rev = responses[0] as {
    summary: { grossRevenue: number; totalDiscount: number; netRevenue: number; totalPaid: number; ordersCount: number };
    byPaymentMethod: { method: string; count: number; total: number }[];
    dailyTrend: { date: string; revenue: number; orders: number }[];
    byPaymentStatus: { status: string; count: number; totalAmount: number; paidAmount: number }[];
  } | null;
  if (rev) {
    addSheet(
      t("reporting.revenue") + " - Daily",
      rev.dailyTrend.map((d) => ({ date: d.date, revenue: d.revenue, orders: d.orders })),
      { date: t("common.date"), revenue: t("common.revenue"), orders: t("common.orders") }
    );
    addSheet(
      t("reporting.revenue") + " - Payment",
      rev.byPaymentMethod.map((r) => ({ method: r.method, count: r.count, total: r.total })),
      { method: t("common.payment"), count: t("common.orders"), total: t("common.total") }
    );
  }

  // 2. Orders
  const ord = responses[1] as {
    summary: { totalOrders: number; avgTurnaroundHours: number | null; totalItems: number; totalWeightKg: number };
    byStatus: { status: string; count: number; totalAmount: number }[];
    serviceBreakdown: { name: string; pricingType: string; orderCount: number; quantity: number; weightKg: number; revenue: number }[];
  } | null;
  if (ord) {
    addSheet(
      t("reporting.orders") + " - Status",
      ord.byStatus.map((s) => ({ status: s.status, count: s.count, total: s.totalAmount })),
      { status: t("common.status"), count: t("common.orders"), total: t("common.total") }
    );
    addSheet(
      t("reporting.orders") + " - Service",
      ord.serviceBreakdown.map((s) => ({
        service: s.name, type: s.pricingType, orders: s.orderCount,
        qty: s.quantity, weightKg: s.weightKg, revenue: s.revenue,
      })),
      { service: t("common.service"), type: "Type", orders: t("common.orders"), qty: t("common.quantity"), weightKg: "Weight (KG)", revenue: t("common.revenue") }
    );
  }

  // 3. Expenses
  const exp = responses[2] as {
    summary: { totalExpenses: number; categoryCount: number; dailyAvg: number };
    byCategory: { category: string; count: number; total: number }[];
    dailyTrend: { date: string; total: number; count: number }[];
  } | null;
  if (exp) {
    addSheet(
      t("reporting.expenses") + " - Daily",
      exp.dailyTrend.map((d) => ({ date: d.date, total: d.total, count: d.count })),
      { date: t("common.date"), total: t("common.total"), count: "Count" }
    );
    addSheet(
      t("reporting.expenses") + " - Category",
      exp.byCategory.map((c) => ({ category: c.category, count: c.count, total: c.total })),
      { category: t("common.category"), count: "Count", total: t("common.total") }
    );
  }

  // 4. Profit
  const prof = responses[3] as {
    summary: { revenue: number; expenses: number; netProfit: number; marginPercent: number };
    dailyComparison: { date: string; revenue: number; expenses: number; profit: number }[];
  } | null;
  if (prof) {
    addSheet(
      t("reporting.profit"),
      prof.dailyComparison.map((d) => ({ date: d.date, revenue: d.revenue, expenses: d.expenses, profit: d.profit })),
      { date: t("common.date"), revenue: t("common.revenue"), expenses: t("reporting.expenses"), profit: t("reporting.profit") }
    );
  }

  // 5. Customers
  const cust = responses[4] as {
    summary: { totalCustomers: number; newCustomers: number; avgSpendPerCustomer: number };
    topSpenders: { name: string; orders: number; totalSpent: number }[];
    outstandingBalance: { name: string; phone: string; totalOutstanding: number; orderCount: number }[];
  } | null;
  if (cust) {
    addSheet(
      t("reporting.customers") + " - Top",
      cust.topSpenders.map((s) => ({ name: s.name, orders: s.orders, totalSpent: s.totalSpent })),
      { name: t("common.name"), orders: t("common.orders"), totalSpent: t("common.total") }
    );
  }

  // 6. Services
  const svc = responses[5] as {
    services: { name: string; pricingType: string; basePrice: number; orderCount: number; totalQuantity: number; totalWeightKg: number; totalRevenue: number }[];
  } | null;
  if (svc) {
    addSheet(
      t("reporting.services"),
      svc.services.map((s) => ({
        service: s.name, type: s.pricingType, basePrice: s.basePrice,
        orders: s.orderCount, qty: s.totalQuantity, weightKg: s.totalWeightKg, revenue: s.totalRevenue,
      })),
      { service: t("common.service"), type: "Type", basePrice: t("common.price"), orders: t("common.orders"), qty: t("common.quantity"), weightKg: "Weight (KG)", revenue: t("common.revenue") }
    );
  }

  // 7. Outstanding
  const out = responses[6] as {
    summary: { totalOutstanding: number; customersAffected: number; ordersAffected: number };
    customers: { name: string; phone: string; totalOutstanding: number; orderCount: number; oldestOrder: string }[];
  } | null;
  if (out) {
    addSheet(
      t("reporting.outstanding"),
      out.customers.map((c) => ({
        name: c.name, phone: c.phone, outstanding: c.totalOutstanding, orders: c.orderCount, oldestOrder: c.oldestOrder,
      })),
      { name: t("common.name"), phone: t("common.phone"), outstanding: "Outstanding", orders: t("common.orders"), oldestOrder: "Oldest Order" }
    );
  }

  XLSX.writeFile(wb, `laporan-keuangan-${from}-to-${to}.xlsx`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
