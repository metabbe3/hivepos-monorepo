"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  AlertTriangle,
  Percent,
  Download,
  FileSpreadsheet,
  FileText,
  Clock,
  Package,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";

interface FinancialStatementProps {
  from: string;
  to: string;
}

interface FinancialData {
  summary: {
    revenue: number;
    expenses: number;
    netProfit: number;
    marginPercent: number;
    totalOrders: number;
    avgOrderValue: number;
    totalOutstanding: number;
    affectedCustomers: number;
  };
  dailyBreakdown: Array<{
    date: string;
    revenue: number;
    expenses: number;
    profit: number;
    orders: number;
  }>;
  topServices: Array<{
    name: string;
    orderCount: number;
    revenue: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    total: number;
    share: number;
  }>;
  byPaymentMethod: Array<{
    method: string;
    count: number;
    total: number;
    share: number;
  }>;
  topCustomers: Array<{
    name: string;
    totalSpent: number;
    orderCount: number;
  }>;
  outstanding: {
    total: number;
    customersAffected: number;
    ordersAffected: number;
    topBalances: Array<{ name: string; balance: number; oldestOrder: string }>;
  };
  turnaround: {
    distribution: {
      under24h: number;
      under48h: number;
      under72h: number;
      over72h: number;
    };
    totalDelivered: number;
    under24hPercent: number;
  };
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
  };
}

function ProgressBar({ value, max, color = "bg-brand" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
      <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export function FinancialStatement({ from, to }: FinancialStatementProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<FinancialData>(`/api/reports/financial-statement?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => {
        setData(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data)
    return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, dailyBreakdown, topServices, expensesByCategory, byPaymentMethod, topCustomers, outstanding, turnaround, inventory } = data;
  const isProfit = summary.netProfit >= 0;
  const maxServiceRevenue = Math.max(...topServices.map((s) => s.revenue), 1);
  const maxCategoryExpense = Math.max(...expensesByCategory.map((c) => c.total), 1);

  // P&L table totals
  const totalDailyRevenue = dailyBreakdown.reduce((s, d) => s + d.revenue, 0);
  const totalDailyExpenses = dailyBreakdown.reduce((s, d) => s + d.expenses, 0);
  const totalDailyProfit = dailyBreakdown.reduce((s, d) => s + d.profit, 0);
  const totalDailyOrders = dailyBreakdown.reduce((s, d) => s + d.orders, 0);

  // Export
  const csvHeaders = {
    date: t("common.date"),
    revenue: t("common.revenue"),
    expenses: t("reporting.expenses"),
    profit: t("reporting.profit"),
    orders: t("common.orders"),
  };
  const csvData = dailyBreakdown.map((d) => ({
    date: formatDate(d.date),
    revenue: d.revenue,
    expenses: d.expenses,
    profit: d.profit,
    orders: d.orders,
  }));
  const baseFilename = `laporan-keuangan-${from}-to-${to}`;

  const summaryCards = [
    {
      title: t("common.revenue"),
      value: formatCurrency(summary.revenue),
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      accentColor: "bg-emerald-500",
    },
    {
      title: t("reporting.expenses"),
      value: formatCurrency(summary.expenses),
      icon: TrendingDown,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-100 dark:bg-rose-900/30",
      accentColor: "bg-rose-500",
    },
    {
      title: t("profitReport.netProfit"),
      value: formatCurrency(summary.netProfit),
      icon: DollarSign,
      iconColor: isProfit ? "text-emerald-600" : "text-red-600",
      iconBg: isProfit ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30",
      accentColor: isProfit ? "bg-emerald-500" : "bg-red-500",
    },
    {
      title: t("ordersReport.totalOrders"),
      value: summary.totalOrders.toLocaleString("id-ID"),
      icon: ShoppingCart,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      accentColor: "bg-blue-500",
    },
    {
      title: t("financial.avgOrderValue"),
      value: formatCurrency(summary.avgOrderValue),
      icon: DollarSign,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      accentColor: "bg-amber-500",
    },
    {
      title: t("financial.outstanding"),
      value: formatCurrency(summary.totalOutstanding),
      icon: AlertTriangle,
      iconColor: summary.totalOutstanding > 0 ? "text-orange-600" : "text-slate-400",
      iconBg: summary.totalOutstanding > 0 ? "bg-orange-100 dark:bg-orange-900/30" : "bg-slate-100 dark:bg-slate-700",
      accentColor: summary.totalOutstanding > 0 ? "bg-orange-500" : "bg-slate-300",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex justify-end gap-1.5">
        <Button variant="outline" size="sm" onClick={() => exportToCsv(csvData, `${baseFilename}.csv`, csvHeaders)}>
          <Download className="size-4" /> {t("common.exportCsv")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportToXls(csvData, `${baseFilename}.xls`, "Laporan Keuangan", csvHeaders)}>
          <FileSpreadsheet className="size-4" /> {t("common.exportXls")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportToPdf("profit", from, to)}>
          <FileText className="size-4" /> {t("common.exportPdf")}
        </Button>
      </div>

      {/* ROW 1: KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            iconColor={card.iconColor}
            iconBg={card.iconBg}
            accentColor={card.accentColor}
          />
        ))}
      </div>

      {/* Profit margin badge */}
      <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-4 py-3">
        <Percent className={`h-5 w-5 ${isProfit ? "text-emerald-600" : "text-red-600"}`} />
        <div>
          <span className="text-sm text-muted-foreground">{t("profitReport.margin")}: </span>
          <span className={`text-lg font-bold ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
            {summary.marginPercent.toFixed(1)}%
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{t("financial.affectedCustomers")}: {summary.affectedCustomers}</span>
        </div>
      </div>

      {/* ROW 2: P&L Daily Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("financial.profitLossStatement")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <ReportTable
              columns={[
                { key: "date", label: t("common.date"), format: (v) => formatDate(v as string) },
                {
                  key: "revenue",
                  label: t("common.revenue"),
                  align: "right",
                  format: (v) => formatCurrency(v as number),
                },
                {
                  key: "expenses",
                  label: t("reporting.expenses"),
                  align: "right",
                  format: (v) => formatCurrency(v as number),
                },
                {
                  key: "profit",
                  label: t("reporting.profit"),
                  align: "right",
                  format: (v) => {
                    const n = v as number;
                    return (
                      <span className={n < 0 ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>
                        {formatCurrency(n)}
                      </span>
                    );
                  },
                },
                {
                  key: "margin",
                  label: t("profitReport.margin"),
                  align: "right",
                  format: (v) => {
                    const n = v as number;
                    return <span className={n < 0 ? "text-red-500" : "text-emerald-500"}>{n.toFixed(1)}%</span>;
                  },
                },
                { key: "orders", label: t("common.orders"), align: "right" },
              ]}
              data={dailyBreakdown.map((d) => ({
                ...d,
                margin: d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0,
              })) as unknown as Record<string, unknown>[]}
              summaryRow={{
                date: "",
                revenue: totalDailyRevenue,
                expenses: totalDailyExpenses,
                profit: totalDailyProfit,
                margin: totalDailyRevenue > 0 ? (totalDailyProfit / totalDailyRevenue) * 100 : 0,
                orders: totalDailyOrders,
              }}
              summaryLabel={t("common.total")}
            />
          </div>
        </CardContent>
      </Card>

      {/* ROW 3: Revenue by Service + Expenses by Category */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Service */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              {t("financial.revenueByService")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("reports.noData")}</p>
            ) : (
              topServices.map((s) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium truncate mr-2">{s.name}</span>
                    <span className="text-muted-foreground shrink-0">{formatCurrency(s.revenue)}</span>
                  </div>
                  <ProgressBar value={s.revenue} max={maxServiceRevenue} color="bg-emerald-500" />
                  <p className="text-xs text-muted-foreground mt-0.5">{s.orderCount} {t("common.orders").toLowerCase()}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-600" />
              {t("expensesReport.byCategory")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expensesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("reports.noData")}</p>
            ) : (
              expensesByCategory.map((c) => (
                <div key={c.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium truncate mr-2">{c.category}</span>
                    <span className="text-muted-foreground shrink-0">
                      {formatCurrency(c.total)} ({c.share.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar value={c.total} max={maxCategoryExpense} color="bg-rose-400" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 4: Payment Methods + Top Customers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>{t("revenue.paymentMethodBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportTable
              columns={[
                {
                  key: "method",
                  label: t("reports.method"),
                  format: (v) =>
                    t(PAYMENT_METHOD_LABELS[v as keyof typeof PAYMENT_METHOD_LABELS] ?? (v as string)),
                },
                { key: "count", label: t("reports.count"), align: "right" },
                {
                  key: "total",
                  label: t("common.amount"),
                  align: "right",
                  format: (v) => formatCurrency(v as number),
                },
                {
                  key: "share",
                  label: t("reports.share"),
                  align: "right",
                  format: (v) => `${(v as number).toFixed(1)}%`,
                },
              ]}
              data={byPaymentMethod as unknown as Record<string, unknown>[]}
            />
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              {t("financial.topCustomers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("reports.noData")}</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-bold text-blue-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.orderCount} {t("common.orders").toLowerCase()}</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">{formatCurrency(c.totalSpent)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 5: Outstanding Payments */}
      {outstanding.total > 0 && (
        <Card className="border-orange-200 dark:border-orange-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              {t("reporting.outstanding")} — {formatCurrency(outstanding.total)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 px-4 py-3">
                <p className="text-xs text-orange-600 dark:text-orange-400">{t("financial.affectedCustomers")}</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{outstanding.customersAffected}</p>
              </div>
              <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 px-4 py-3">
                <p className="text-xs text-orange-600 dark:text-orange-400">{t("financial.unpaidOrders")}</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{outstanding.ordersAffected}</p>
              </div>
            </div>
            {outstanding.topBalances.length > 0 && (
              <div className="space-y-2">
                {outstanding.topBalances.map((b, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-800 px-3 py-2 border border-border/40">
                    <div>
                      <p className="text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("financial.oldestOrder")}: {formatDate(b.oldestOrder)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-orange-600">{formatCurrency(b.balance)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ROW 6: Operational Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Turnaround */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-600" />
              {t("ordersReport.turnaroundDistribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {turnaround.totalDelivered === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">{t("reports.noData")}</p>
            ) : (
              <>
                <div className="mb-3">
                  <span className="text-2xl font-bold text-emerald-600">{turnaround.under24hPercent.toFixed(0)}%</span>
                  <span className="text-sm text-muted-foreground ml-1">{t("financial.under24h")}</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: t("ordersReport.under24h"), count: turnaround.distribution.under24h, color: "bg-emerald-500" },
                    { label: t("ordersReport.24to48h"), count: turnaround.distribution.under48h, color: "bg-amber-500" },
                    { label: t("ordersReport.48to72h"), count: turnaround.distribution.under72h, color: "bg-orange-500" },
                    { label: t("ordersReport.over72h"), count: turnaround.distribution.over72h, color: "bg-red-500" },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-2 text-xs">
                      <div className={`h-2 w-2 rounded-full ${r.color}`} />
                      <span className="flex-1 text-muted-foreground">{r.label}</span>
                      <span className="font-medium">{r.count}</span>
                      <span className="text-muted-foreground w-10 text-right">
                        {turnaround.totalDelivered > 0 ? ((r.count / turnaround.totalDelivered) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Inventory */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-blue-600" />
              {t("reporting.inventory")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("financial.totalItems")}</span>
              <span className="text-sm font-semibold">{inventory.totalItems}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("financial.stockValue")}</span>
              <span className="text-sm font-semibold">{formatCurrency(inventory.totalValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("financial.lowStock")}</span>
              {inventory.lowStockCount > 0 ? (
                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {inventory.lowStockCount} {t("financial.itemsLow")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {t("financial.allGood")}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowUpRight className="h-4 w-4 text-brand" />
              {t("financial.quickSummary")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("financial.profitMargin")}</span>
              <span className={`text-sm font-bold ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
                {summary.marginPercent.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("financial.revenuePerOrder")}</span>
              <span className="text-sm font-semibold">{formatCurrency(summary.avgOrderValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("financial.collectionRate")}</span>
              <span className="text-sm font-semibold">
                {summary.revenue + summary.totalOutstanding > 0
                  ? ((summary.revenue / (summary.revenue + summary.totalOutstanding)) * 100).toFixed(0)
                  : 100}
                %
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
