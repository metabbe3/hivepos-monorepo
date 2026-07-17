"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Clock, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency } from "@/lib/format";
import { ORDER_STATUS_CONFIG, PRICING_TYPE_LABELS } from "@/lib/constants";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";

interface OrdersReportProps {
  from: string;
  to: string;
}

interface OrdersSummary {
  totalOrders: number;
  avgTurnaroundHours: number | null;
  totalItems: number;
  totalWeightKg: number;
}

interface StatusRow {
  status: string;
  count: number;
  totalAmount: number;
}

interface ServiceBreakdownRow {
  serviceId: string;
  name: string;
  pricingType: string;
  orderCount: number;
  quantity: number;
  weightKg: number;
  revenue: number;
}

interface TurnaroundDistribution {
  under24h: number;
  under48h: number;
  under72h: number;
  over72h: number;
}

interface OrdersData {
  summary: OrdersSummary;
  byStatus: StatusRow[];
  serviceBreakdown: ServiceBreakdownRow[];
  turnaroundDistribution: TurnaroundDistribution;
  dailyVolume: Array<{ date: string; count: number }>;
}

export function OrdersReport({ from, to }: OrdersReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<OrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<OrdersData>(`/api/reports/orders?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, byStatus, serviceBreakdown, turnaroundDistribution } = data;

  const totalStatusCount = byStatus.reduce((s, r) => s + r.count, 0);
  const totalStatusAmount = byStatus.reduce((s, r) => s + r.totalAmount, 0);

  const totalServiceOrders = serviceBreakdown.reduce((s, r) => s + r.orderCount, 0);
  const totalServiceRevenue = serviceBreakdown.reduce((s, r) => s + r.revenue, 0);

  const turnaroundTotal =
    turnaroundDistribution.under24h +
    turnaroundDistribution.under48h +
    turnaroundDistribution.under72h +
    turnaroundDistribution.over72h;

  // Export data
  const statusExportData = byStatus.map((r) => ({
    status: t(ORDER_STATUS_CONFIG[r.status as keyof typeof ORDER_STATUS_CONFIG]?.labelKey ?? r.status),
    count: r.count,
    totalAmount: r.totalAmount,
  }));
  const serviceExportData = serviceBreakdown.map((r) => ({
    service: r.name,
    type: t(PRICING_TYPE_LABELS[r.pricingType as keyof typeof PRICING_TYPE_LABELS] ?? r.pricingType),
    orders: r.orderCount,
    quantity: r.quantity,
    weightKg: r.weightKg,
    revenue: r.revenue,
  }));
  const statusRows = statusExportData.map((r) => Object.assign({ section: "Status" }, r));
  const serviceRows = serviceExportData.map((r) => Object.assign({ section: "Service" }, r));
  const combinedExportData = [...statusRows, ...serviceRows];
  const combinedHeaders = {
    section: t("reports.section"),
    status: t("common.status"),
    service: t("common.service"),
    type: t("reports.type"),
    count: t("reports.count"),
    orders: t("common.orders"),
    quantity: t("common.quantity"),
    weightKg: t("reports.weightKg"),
    totalAmount: t("reports.totalAmount"),
    revenue: t("common.revenue"),
  };
  const baseFilename = `orders-report-${from}-to-${to}`;

  const summaryCards = [
    {
      title: t("ordersReport.totalOrders"),
      value: summary.totalOrders.toLocaleString("id-ID"),
      icon: ShoppingCart,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      accentColor: "bg-blue-500",
    },
    {
      title: t("ordersReport.avgTurnaround"),
      value:
        summary.avgTurnaroundHours !== null
          ? `${summary.avgTurnaroundHours.toFixed(1)} ${t("reports.hours")}`
          : t("reports.notApplicable"),
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      accentColor: "bg-amber-500",
    },
    {
      title: t("reports.totalItems"),
      value: summary.totalItems.toLocaleString("id-ID"),
      icon: ShoppingCart,
      iconColor: "text-sky-600",
      iconBg: "bg-sky-100 dark:bg-sky-900/30",
      accentColor: "bg-sky-500",
    },
    {
      title: t("reports.totalWeight"),
      value: `${summary.totalWeightKg.toFixed(1)} kg`,
      icon: ShoppingCart,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      accentColor: "bg-purple-500",
    },
  ];

  const turnaroundRows = [
    { range: t("ordersReport.under24h"), count: turnaroundDistribution.under24h },
    { range: t("ordersReport.24to48h"), count: turnaroundDistribution.under48h },
    { range: t("ordersReport.48to72h"), count: turnaroundDistribution.under72h },
    { range: t("ordersReport.over72h"), count: turnaroundDistribution.over72h },
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

      {/* Status Distribution */}
      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("ordersReport.statusDistribution")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(combinedExportData, `${baseFilename}.csv`, combinedHeaders)}
            >
              <Download className="size-4" />
              {t("common.exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToXls(combinedExportData, `${baseFilename}.xls`, "Orders", combinedHeaders)
              }
            >
              <FileSpreadsheet className="size-4" />
              {t("common.exportXls")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToPdf("orders", from, to)}
            >
              <FileText className="size-4" />
              {t("common.exportPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              {
                key: "status",
                label: t("common.status"),
                format: (v) => {
                  const cfg = ORDER_STATUS_CONFIG[v as keyof typeof ORDER_STATUS_CONFIG];
                  if (!cfg) return v as string;
                  return (
                    <Badge className={cfg.color} variant="secondary">
                      {t(cfg.labelKey)}
                    </Badge>
                  );
                },
              },
              { key: "count", label: t("reports.count"), align: "right" },
              {
                key: "percentage",
                label: t("reports.percentage"),
                align: "right",
                format: (v) => `${(v as number).toFixed(1)}%`,
              },
              {
                key: "totalAmount",
                label: t("reports.totalAmount"),
                align: "right",
                format: (v) => formatCurrency(v as number),
              },
            ]}
            data={byStatus.map((r) => ({
              ...r,
              percentage: totalStatusCount > 0 ? (r.count / totalStatusCount) * 100 : 0,
            })) as unknown as Record<string, unknown>[]}
            summaryRow={{
              status: "",
              count: totalStatusCount,
              percentage: 100,
              totalAmount: totalStatusAmount,
            }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      {/* Service Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t("ordersReport.serviceBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              {
                key: "name",
                label: t("common.service"),
                format: (v, row) => {
                  const id = (row as Record<string, unknown>).serviceId as string;
                  if (!id) return v as string;
                  return (
                    <Link href="/laundry/services" className="text-primary hover:underline">
                      {v as string}
                    </Link>
                  );
                },
              },
              {
                key: "pricingType",
                label: t("reports.type"),
                format: (v) => (
                  <Badge variant="outline">
                    {t(PRICING_TYPE_LABELS[v as keyof typeof PRICING_TYPE_LABELS] ?? (v as string))}
                  </Badge>
                ),
              },
              { key: "orderCount", label: t("common.orders"), align: "right" },
              {
                key: "quantityDisplay",
                label: t("reports.qtyOrWeight"),
                align: "right",
                format: (v) => v as string,
              },
              {
                key: "revenue",
                label: t("common.revenue"),
                align: "right",
                format: (v) => formatCurrency(v as number),
              },
              {
                key: "avgValue",
                label: t("reports.avgValue"),
                align: "right",
                format: (v) => formatCurrency(v as number),
              },
            ]}
            data={serviceBreakdown.map((r) => ({
              ...r,
              quantityDisplay:
                r.pricingType === "PER_KG" ? `${r.weightKg.toFixed(1)} kg` : `${r.quantity}`,
              avgValue: r.orderCount > 0 ? r.revenue / r.orderCount : 0,
            })) as unknown as Record<string, unknown>[]}
            summaryRow={{
              name: "",
              pricingType: "",
              orderCount: totalServiceOrders,
              quantityDisplay: "",
              revenue: totalServiceRevenue,
              avgValue: totalServiceOrders > 0 ? totalServiceRevenue / totalServiceOrders : 0,
            }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      {/* Turnaround Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>{t("ordersReport.turnaroundDistribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "range", label: t("reports.timeRange") },
              { key: "count", label: t("reports.count"), align: "right" },
              {
                key: "percentage",
                label: t("reports.percentage"),
                align: "right",
                format: (v) => `${(v as number).toFixed(1)}%`,
              },
            ]}
            data={turnaroundRows.map((r) => ({
              ...r,
              percentage: turnaroundTotal > 0 ? (r.count / turnaroundTotal) * 100 : 0,
            })) as unknown as Record<string, unknown>[]}
            summaryRow={{
              range: "",
              count: turnaroundTotal,
              percentage: 100,
            }}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
