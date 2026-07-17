"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_CONFIG } from "@/lib/constants";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";
import { TrendChart } from "@/components/shared/trend-chart";

interface RevenueReportProps {
  from: string;
  to: string;
}

interface RevenueSummary {
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  totalPaid: number;
  ordersCount: number;
}

interface PaymentMethodRow {
  method: string;
  count: number;
  total: number;
}

interface DailyTrendRow {
  date: string;
  revenue: number;
  grossRevenue: number;
  netRevenue: number;
  orders: number;
  byMethod: Record<string, number>;
}

interface PaymentStatusRow {
  status: string;
  count: number;
  totalAmount: number;
  paidAmount: number;
}

interface RevenueData {
  summary: RevenueSummary;
  byPaymentMethod: PaymentMethodRow[];
  dailyTrend: DailyTrendRow[];
  byPaymentStatus: PaymentStatusRow[];
}

export function RevenueReport({ from, to }: RevenueReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<RevenueData>(`/api/reports/revenue?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, byPaymentMethod, dailyTrend, byPaymentStatus } = data;

  // Compute cumulative revenue for daily trend (based on gross)
  const dailyWithCumulative = dailyTrend.map(
    (
      (cumulative) => (row: DailyTrendRow) => ({
        ...row,
        cumulative: (cumulative += row.netRevenue),
      })
    )(0)
  );

  const totalNetRevenue = dailyTrend.reduce((sum, d) => sum + d.netRevenue, 0);
  const totalRevenue = dailyTrend.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = dailyTrend.reduce((sum, d) => sum + d.orders, 0);

  // Collect all payment methods that appear in daily data
  const methodKeys = Array.from(new Set(dailyTrend.flatMap((d) => Object.keys(d.byMethod)))).sort();

  // Compute totals per method for summary row
  const methodTotals: Record<string, number> = {};
  for (const key of methodKeys) {
    methodTotals[key] = dailyTrend.reduce((sum, d) => sum + (d.byMethod[key] || 0), 0);
  }

  const totalMethodCount = byPaymentMethod.reduce((s, r) => s + r.count, 0);
  const totalMethodAmount = byPaymentMethod.reduce((s, r) => s + r.total, 0);

  // Export data
  const csvHeaders = { date: t("common.date"), netRevenue: t("revenue.netRevenue"), revenue: t("revenue.totalPaid"), orders: t("common.orders") };
  const csvData = dailyTrend.map((d) => ({
    date: formatDate(d.date),
    netRevenue: d.netRevenue,
    revenue: d.revenue,
    orders: d.orders,
  }));
  const baseFilename = `revenue-report-${from}-to-${to}`;

  const summaryCards = [
    {
      title: t("revenue.grossRevenue"),
      value: formatCurrency(summary.grossRevenue),
      icon: DollarSign,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      accentColor: "bg-amber-500",
    },
    {
      title: t("revenue.netRevenue"),
      value: formatCurrency(summary.netRevenue),
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      accentColor: "bg-emerald-500",
    },
    {
      title: t("revenue.discounts"),
      value: formatCurrency(summary.totalDiscount),
      icon: DollarSign,
      iconColor: "text-red-600",
      iconBg: "bg-red-100 dark:bg-red-900/30",
      accentColor: "bg-red-500",
    },
    {
      title: t("revenue.totalPaid"),
      value: formatCurrency(summary.totalPaid),
      icon: DollarSign,
      iconColor: "text-green-600",
      iconBg: "bg-green-100 dark:bg-green-900/30",
      accentColor: "bg-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.title}>
            <StatCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              iconColor={card.iconColor}
              iconBg={card.iconBg}
              accentColor={card.accentColor}
            />
          </div>
        ))}
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("revenue.dailyRevenueTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={dailyTrend as unknown as Record<string, unknown>[]}
            lines={[
              { dataKey: "grossRevenue", color: "#10b981", name: t("revenue.grossRevenue") },
              { dataKey: "revenue", color: "#6366f1", name: t("revenue.totalPaid") },
              { dataKey: "orders", color: "#f59e0b", name: t("common.orders"), type: "bar", yAxisId: "right" },
            ]}
            formatValue={(v) => formatCurrency(v)}
          />
        </CardContent>
      </Card>

      {/* Daily Revenue Trend */}
      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("revenue.dailyRevenueTrend")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(csvData, `${baseFilename}.csv`, csvHeaders)}
            >
              <Download className="size-4" />
              {t("common.exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToXls(csvData, `${baseFilename}.xls`, "Revenue", csvHeaders)}
            >
              <FileSpreadsheet className="size-4" />
              {t("common.exportXls")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToPdf("revenue", from, to)}
            >
              <FileText className="size-4" />
              {t("common.exportPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <ReportTable
              columns={[
                { key: "date", label: t("common.date"), format: (v) => formatDate(v as string) },
                ...methodKeys.map((method) => ({
                  key: `method_${method}`,
                  label: t(PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method),
                  align: "right" as const,
                  format: (v: unknown) => (v as number) ? formatCurrency(v as number) : "-",
                })),
                { key: "netRevenue", label: t("revenue.netRevenue"), align: "right", format: (v) => formatCurrency(v as number) },
                { key: "revenue", label: t("revenue.totalPaid"), align: "right", format: (v) => formatCurrency(v as number) },
                { key: "orders", label: t("common.orders"), align: "right" },
                { key: "cumulative", label: t("revenue.cumulative"), align: "right", format: (v) => formatCurrency(v as number) },
              ]}
              data={dailyWithCumulative.map((row) => {
                const flat: Record<string, unknown> = { date: row.date, netRevenue: row.netRevenue, revenue: row.revenue, orders: row.orders, cumulative: row.cumulative };
                for (const method of methodKeys) {
                  flat[`method_${method}`] = row.byMethod?.[method] || 0;
                }
                return flat;
              }) as unknown as Record<string, unknown>[]}
              summaryRow={{
                date: "",
                ...Object.fromEntries(methodKeys.map((m) => [`method_${m}`, methodTotals[m]])),
                netRevenue: totalNetRevenue,
                revenue: totalRevenue,
                orders: totalOrders,
                cumulative: totalNetRevenue,
              }}
              summaryLabel={t("common.total")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Breakdown */}
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
            data={byPaymentMethod.map((r) => ({
              ...r,
              share: totalMethodAmount > 0 ? (r.total / totalMethodAmount) * 100 : 0,
            })) as unknown as Record<string, unknown>[]}
            summaryRow={{
              method: "",
              count: totalMethodCount,
              total: totalMethodAmount,
              share: 100,
            }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      {/* Payment Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t("revenue.paymentStatusBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              {
                key: "status",
                label: t("common.status"),
                format: (v) => {
                  const cfg = PAYMENT_STATUS_CONFIG[v as keyof typeof PAYMENT_STATUS_CONFIG];
                  if (!cfg) return v as string;
                  return (
                    <Badge className={cfg.color} variant="secondary">
                      {t(cfg.labelKey)}
                    </Badge>
                  );
                },
              },
              { key: "count", label: t("common.orders"), align: "right" },
              {
                key: "totalAmount",
                label: t("reports.totalAmount"),
                align: "right",
                format: (v) => formatCurrency(v as number),
              },
              {
                key: "paidAmount",
                label: t("reports.paidAmount"),
                align: "right",
                format: (v) => formatCurrency(v as number),
              },
            ]}
            data={byPaymentStatus as unknown as Record<string, unknown>[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
