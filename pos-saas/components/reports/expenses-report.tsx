"use client";

import { useEffect, useState } from "react";
import { DollarSign, Tag, TrendingDown, Download, FileSpreadsheet, FileText } from "lucide-react";
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

interface ExpensesReportProps {
  from: string;
  to: string;
}

interface ExpensesData {
  summary: {
    totalExpenses: number;
    categoryCount: number;
    dailyAvg: number;
  };
  byCategory: { category: string; count: number; total: number }[];
  dailyTrend: { date: string; total: number; count: number }[];
}

export function ExpensesReport({ from, to }: ExpensesReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<ExpensesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<ExpensesData>(`/api/reports/expenses?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, byCategory, dailyTrend } = data;

  const totalCategoryTotal = byCategory.reduce((s, r) => s + r.total, 0);
  const totalDailyTotal = dailyTrend.reduce((s, d) => s + d.total, 0);
  const totalDailyCount = dailyTrend.reduce((s, d) => s + d.count, 0);

  const csvHeaders = { date: t("common.date"), total: t("common.total"), count: t("reports.count") };
  const csvData = dailyTrend.map((d) => ({ date: formatDate(d.date), total: d.total, count: d.count }));
  const baseFilename = `expenses-report-${from}-to-${to}`;

  const summaryCards = [
    { title: t("expensesReport.totalExpenses"), value: formatCurrency(summary.totalExpenses), icon: DollarSign, iconColor: "text-rose-600", iconBg: "bg-rose-100 dark:bg-rose-900/30", accentColor: "bg-rose-500" },
    { title: t("expensesReport.categories"), value: String(summary.categoryCount), icon: Tag, iconColor: "text-violet-600", iconBg: "bg-violet-100 dark:bg-violet-900/30", accentColor: "bg-violet-500" },
    { title: t("expensesReport.dailyAverage"), value: formatCurrency(summary.dailyAvg), icon: TrendingDown, iconColor: "text-amber-600", iconBg: "bg-amber-100 dark:bg-amber-900/30", accentColor: "bg-amber-500" },
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

      {/* Expenses Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("expensesReport.dailyExpensesTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={dailyTrend as unknown as Record<string, unknown>[]}
            lines={[
              { dataKey: "total", color: "#ef4444", name: t("expensesReport.totalExpenses") },
            ]}
            formatValue={(v) => formatCurrency(v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("expensesReport.byCategory")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => exportToCsv(csvData, `${baseFilename}.csv`, csvHeaders)}>
              <Download className="size-4" /> {t("common.exportCsv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToXls(csvData, `${baseFilename}.xls`, "Expenses", csvHeaders)}>
              <FileSpreadsheet className="size-4" /> {t("common.exportXls")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPdf("expenses", from, to)}>
              <FileText className="size-4" /> {t("common.exportPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "category", label: t("common.category") },
              { key: "count", label: t("reports.entries"), align: "right" },
              { key: "total", label: t("common.total"), align: "right", format: (v) => formatCurrency(v as number) },
              { key: "share", label: t("reports.share"), align: "right", format: (v) => `${(v as number).toFixed(1)}%` },
            ]}
            data={byCategory.map((r) => ({
              ...r,
              share: totalCategoryTotal > 0 ? (r.total / totalCategoryTotal) * 100 : 0,
            })) as unknown as Record<string, unknown>[]}
            summaryRow={{ category: "", count: byCategory.reduce((s, r) => s + r.count, 0), total: totalCategoryTotal, share: 100 }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("expensesReport.dailyExpensesTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "date", label: t("common.date"), format: (v) => formatDate(v as string) },
              { key: "total", label: t("common.total"), align: "right", format: (v) => formatCurrency(v as number) },
              { key: "count", label: t("reports.entries"), align: "right" },
            ]}
            data={dailyTrend as unknown as Record<string, unknown>[]}
            summaryRow={{ date: "", total: totalDailyTotal, count: totalDailyCount }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
