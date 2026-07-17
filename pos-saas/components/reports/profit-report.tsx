"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, Percent, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";
import { TrendChart } from "@/components/shared/trend-chart";

interface ProfitReportProps {
  from: string;
  to: string;
}

interface ProfitData {
  summary: {
    revenue: number;
    expenses: number;
    netProfit: number;
    marginPercent: number;
  };
  dailyComparison: { date: string; revenue: number; expenses: number; profit: number }[];
}

export function ProfitReport({ from, to }: ProfitReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<ProfitData>(`/api/reports/profit?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, dailyComparison } = data;

  const totalRevenue = dailyComparison.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses = dailyComparison.reduce((s, d) => s + d.expenses, 0);
  const totalProfit = dailyComparison.reduce((s, d) => s + d.profit, 0);

  const csvHeaders = { date: t("common.date"), revenue: t("common.revenue"), expenses: t("reporting.expenses"), profit: t("reporting.profit") };
  const csvData = dailyComparison.map((d) => ({
    date: formatDate(d.date),
    revenue: d.revenue,
    expenses: d.expenses,
    profit: d.profit,
  }));
  const baseFilename = `profit-report-${from}-to-${to}`;

  const isProfit = summary.netProfit >= 0;

  const summaryCards = [
    { title: t("common.revenue"), value: formatCurrency(summary.revenue), icon: TrendingUp, iconColor: "text-emerald-600", iconBg: "bg-emerald-100 dark:bg-emerald-900/30", accentColor: "bg-emerald-500" },
    { title: t("reporting.expenses"), value: formatCurrency(summary.expenses), icon: TrendingDown, iconColor: "text-rose-600", iconBg: "bg-rose-100 dark:bg-rose-900/30", accentColor: "bg-rose-500" },
    { title: t("profitReport.netProfit"), value: formatCurrency(summary.netProfit), icon: DollarSign, iconColor: isProfit ? "text-emerald-600" : "text-red-600", iconBg: isProfit ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30", accentColor: isProfit ? "bg-emerald-500" : "bg-red-500" },
    { title: t("profitReport.margin"), value: `${summary.marginPercent.toFixed(1)}%`, icon: Percent, iconColor: "text-amber-600", iconBg: "bg-amber-100 dark:bg-amber-900/30", accentColor: "bg-amber-500" },
  ];

  return (
    <div className="space-y-6">
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

      {/* Profit Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("profitReport.dailyComparison")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={dailyComparison as unknown as Record<string, unknown>[]}
            lines={[
              { dataKey: "revenue", color: "#10b981", name: t("common.revenue") },
              { dataKey: "expenses", color: "#ef4444", name: t("reporting.expenses") },
              { dataKey: "profit", color: "#6366f1", name: t("reporting.profit"), dashed: true },
            ]}
            formatValue={(v) => formatCurrency(v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("profitReport.dailyComparison")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => exportToCsv(csvData, `${baseFilename}.csv`, csvHeaders)}>
              <Download className="size-4" /> {t("common.exportCsv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToXls(csvData, `${baseFilename}.xls`, "Profit", csvHeaders)}>
              <FileSpreadsheet className="size-4" /> {t("common.exportXls")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPdf("profit", from, to)}>
              <FileText className="size-4" /> {t("common.exportPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "date", label: t("common.date"), format: (v) => formatDate(v as string) },
              { key: "revenue", label: t("common.revenue"), align: "right", format: (v) => formatCurrency(v as number) },
              { key: "expenses", label: t("reporting.expenses"), align: "right", format: (v) => formatCurrency(v as number) },
              { key: "profit", label: t("reporting.profit"), align: "right", format: (v) => {
                const n = v as number;
                return <span className={n < 0 ? "text-red-600" : "text-emerald-600"}>{formatCurrency(n)}</span>;
              }},
            ]}
            data={dailyComparison as unknown as Record<string, unknown>[]}
            summaryRow={{ date: "", revenue: totalRevenue, expenses: totalExpenses, profit: totalProfit }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
