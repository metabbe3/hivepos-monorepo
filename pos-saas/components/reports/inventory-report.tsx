"use client";

import { useEffect, useState } from "react";
import { Package, DollarSign, AlertTriangle, ShoppingCart, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";

interface InventoryReportProps {
  from: string;
  to: string;
}

interface InventoryData {
  summary: {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    recentPurchases: number;
  };
  stockLevels: { name: string; unit: string; quantity: number; threshold: number; value: number; isLow: boolean }[];
  recentMovements: { name: string; type: string; quantity: number; date: string; notes: string | null }[];
}

export function InventoryReport({ from, to }: InventoryReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<InventoryData>(`/api/reports/inventory?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, stockLevels, recentMovements } = data;

  const csvHeaders = { name: t("reports.item"), unit: t("common.unit"), quantity: t("common.quantity"), value: t("reports.value") };
  const csvData = stockLevels.map((s) => ({ name: s.name, unit: s.unit, quantity: s.quantity, value: s.value }));
  const baseFilename = `inventory-report-${from}-to-${to}`;

  const summaryCards = [
    { title: t("inventoryReport.totalItems"), value: String(summary.totalItems), icon: Package, iconColor: "text-teal-600", iconBg: "bg-teal-100 dark:bg-teal-900/30", accentColor: "bg-teal-500" },
    { title: t("inventoryReport.totalValue"), value: formatCurrency(summary.totalValue), icon: DollarSign, iconColor: "text-amber-600", iconBg: "bg-amber-100 dark:bg-amber-900/30", accentColor: "bg-amber-500" },
    { title: t("inventoryReport.lowStock"), value: String(summary.lowStockCount), icon: AlertTriangle, iconColor: "text-red-600", iconBg: "bg-red-100 dark:bg-red-900/30", accentColor: "bg-red-500" },
    { title: t("inventoryReport.purchases"), value: String(summary.recentPurchases), icon: ShoppingCart, iconColor: "text-emerald-600", iconBg: "bg-emerald-100 dark:bg-emerald-900/30", accentColor: "bg-emerald-500" },
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

      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("inventoryReport.stockLevels")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => exportToCsv(csvData, `${baseFilename}.csv`, csvHeaders)}>
              <Download className="size-4" /> {t("common.exportCsv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToXls(csvData, `${baseFilename}.xls`, "Inventory", csvHeaders)}>
              <FileSpreadsheet className="size-4" /> {t("common.exportXls")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPdf("inventory", from, to)}>
              <FileText className="size-4" /> {t("common.exportPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "name", label: t("reports.item") },
              { key: "unit", label: t("common.unit") },
              { key: "quantity", label: t("common.quantity"), align: "right" },
              { key: "threshold", label: t("reports.threshold"), align: "right" },
              { key: "value", label: t("reports.value"), align: "right", format: (v) => formatCurrency(v as number) },
              { key: "status", label: t("common.status"), align: "center", format: (v, row) => {
                const isLow = (row as Record<string, unknown>).isLow;
                return isLow
                  ? <Badge className="bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300">{t("status.low")}</Badge>
                  : <Badge className="bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">{t("status.ok")}</Badge>;
              }},
            ]}
            data={stockLevels as unknown as Record<string, unknown>[]}
          />
        </CardContent>
      </Card>

      {recentMovements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("inventoryReport.recentMovements")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportTable
              columns={[
                { key: "name", label: t("reports.item") },
                { key: "type", label: t("reports.type"), format: (v) => {
                  const isOut = v === "OUT";
                  return <Badge className={isOut ? "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300" : "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"}>{isOut ? t("reports.out") : t("reports.in")}</Badge>;
                }},
                { key: "quantity", label: t("common.quantity"), align: "right" },
                { key: "date", label: t("common.date"), format: (v) => formatDate(v as string) },
                { key: "notes", label: t("common.notes") },
              ]}
              data={recentMovements as unknown as Record<string, unknown>[]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
