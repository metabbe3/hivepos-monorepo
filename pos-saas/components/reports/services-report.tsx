"use client";

import { useEffect, useState } from "react";
import { Sparkles, Weight, Package, Award, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { StatCard } from "@/components/shared/stat-card";
import { formatCurrency } from "@/lib/format";
import { PRICING_TYPE_LABELS } from "@/lib/constants";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";

interface ServicesReportProps {
  from: string;
  to: string;
}

interface ServiceEntry {
  serviceId: string;
  name: string;
  pricingType: string;
  basePrice: number;
  orderCount: number;
  totalQuantity: number;
  totalWeightKg: number;
  totalRevenue: number;
  avgOrderValue: number;
}

interface PricingTypeBreakdown {
  orderCount: number;
  totalWeightKg: number;
  totalQuantity: number;
  revenue: number;
}

interface ServicesReportData {
  services: ServiceEntry[];
  byPricingType: {
    PER_KG: PricingTypeBreakdown;
    PER_ITEM: PricingTypeBreakdown;
  };
}

export function ServicesReport({ from, to }: ServicesReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<ServicesReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<ServicesReportData>(`/api/reports/services?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { services, byPricingType } = data;

  const topService = services.length > 0
    ? services.reduce((prev, curr) => (curr.totalRevenue > prev.totalRevenue ? curr : prev), services[0])
    : null;

  const serviceSummary = {
    serviceId: "",
    name: t("common.total"),
    pricingType: "",
    basePrice: 0,
    orderCount: services.reduce((sum, s) => sum + s.orderCount, 0),
    totalQuantity: services.reduce((sum, s) => sum + s.totalQuantity, 0),
    totalWeightKg: services.reduce((sum, s) => sum + s.totalWeightKg, 0),
    totalRevenue: services.reduce((sum, s) => sum + s.totalRevenue, 0),
    avgOrderValue: services.length > 0
      ? services.reduce((sum, s) => sum + s.avgOrderValue, 0) / services.length
      : 0,
  };

  const totalRevenue = byPricingType.PER_KG.revenue + byPricingType.PER_ITEM.revenue;

  const pricingComparisonData = [
    {
      type: "PER_KG" as const,
      label: t(PRICING_TYPE_LABELS.PER_KG),
      orderCount: byPricingType.PER_KG.orderCount,
      totalValue: byPricingType.PER_KG.totalWeightKg,
      revenue: byPricingType.PER_KG.revenue,
      share: totalRevenue > 0 ? (byPricingType.PER_KG.revenue / totalRevenue) * 100 : 0,
    },
    {
      type: "PER_ITEM" as const,
      label: t(PRICING_TYPE_LABELS.PER_ITEM),
      orderCount: byPricingType.PER_ITEM.orderCount,
      totalValue: byPricingType.PER_ITEM.totalQuantity,
      revenue: byPricingType.PER_ITEM.revenue,
      share: totalRevenue > 0 ? (byPricingType.PER_ITEM.revenue / totalRevenue) * 100 : 0,
    },
  ];

  const csvHeaders: Record<string, string> = {
    name: t("common.service"),
    pricingType: t("reports.type"),
    orderCount: t("common.orders"),
    totalWeightKg: t("reports.weightKg"),
    totalQuantity: t("common.quantity"),
    totalRevenue: t("common.revenue"),
    avgOrderValue: t("reports.avgValue"),
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("servicesReport.totalServicesUsed")}
          value={services.length}
          icon={Sparkles}
          iconColor="text-violet-600"
          iconBg="bg-violet-50 dark:bg-violet-950/50"
          accentColor="bg-violet-500"
        />
        <StatCard
          title={t("servicesReport.perKgRevenue")}
          value={formatCurrency(byPricingType.PER_KG.revenue)}
          icon={Weight}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          accentColor="bg-amber-500"
        />
        <StatCard
          title={t("servicesReport.perItemRevenue")}
          value={formatCurrency(byPricingType.PER_ITEM.revenue)}
          icon={Package}
          iconColor="text-sky-600"
          iconBg="bg-sky-50 dark:bg-sky-950/50"
          accentColor="bg-sky-500"
        />
        <StatCard
          title={t("servicesReport.topService")}
          value={topService?.name ?? "\u2014"}
          icon={Award}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          accentColor="bg-emerald-500"
        />
      </div>

      {/* Service Performance Table */}
      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("servicesReport.servicePerformance")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCsv(
                  services.map((s) => ({
                    name: s.name,
                    pricingType: t(PRICING_TYPE_LABELS[s.pricingType as keyof typeof PRICING_TYPE_LABELS] ?? s.pricingType),
                    orderCount: s.orderCount,
                    totalWeightKg: s.totalWeightKg,
                    totalQuantity: s.totalQuantity,
                    totalRevenue: s.totalRevenue,
                    avgOrderValue: s.avgOrderValue,
                  })),
                  `services-report-${from}-${to}.csv`,
                  csvHeaders
                )
              }
            >
              <Download className="size-4" />
              {t("common.exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToXls(
                  services.map((s) => ({
                    name: s.name,
                    pricingType: t(PRICING_TYPE_LABELS[s.pricingType as keyof typeof PRICING_TYPE_LABELS] ?? s.pricingType),
                    orderCount: s.orderCount,
                    totalWeightKg: s.totalWeightKg,
                    totalQuantity: s.totalQuantity,
                    totalRevenue: s.totalRevenue,
                    avgOrderValue: s.avgOrderValue,
                  })),
                  `services-report-${from}-${to}.xlsx`,
                  "Services",
                  csvHeaders
                )
              }
            >
              <FileSpreadsheet className="size-4" />
              {t("common.exportXls")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToPdf("services", from, to)}
            >
              <FileText className="size-4" />
              {t("common.exportPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "name", label: t("common.service"), align: "left" },
              {
                key: "pricingType",
                label: t("reports.type"),
                align: "center",
                format: (val: unknown) => (
                  <Badge variant="secondary">
                    {t(PRICING_TYPE_LABELS[val as keyof typeof PRICING_TYPE_LABELS] ?? String(val))}
                  </Badge>
                ),
              },
              { key: "orderCount", label: t("common.orders"), align: "right" },
              {
                key: "qtyOrWeight",
                label: t("reports.qtyOrWeight"),
                align: "right",
                format: (_val: unknown, row: Record<string, unknown>) => {
                  const entry = row as unknown as ServiceEntry;
                  return entry.pricingType === "PER_KG"
                    ? `${entry.totalWeightKg.toFixed(1)} kg`
                    : String(entry.totalQuantity);
                },
              },
              {
                key: "totalRevenue",
                label: t("common.revenue"),
                align: "right",
                format: (val: unknown) => formatCurrency(val as number),
              },
              {
                key: "avgOrderValue",
                label: t("reports.avgValue"),
                align: "right",
                format: (val: unknown) => formatCurrency(val as number),
              },
            ]}
            data={services as unknown as Record<string, unknown>[]}
            summaryRow={serviceSummary as unknown as Record<string, unknown>}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      {/* Pricing Type Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("servicesReport.pricingTypeComparison")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            columns={[
              { key: "label", label: t("reports.type"), align: "left" },
              { key: "orderCount", label: t("common.orders"), align: "right" },
              {
                key: "totalValue",
                label: t("reports.totalQtyOrWeight"),
                align: "right",
                format: (val: unknown, row: Record<string, unknown>) => {
                  const entry = row as { type: string };
                  const numVal = val as number;
                  return entry.type === "PER_KG"
                    ? `${numVal.toFixed(1)} kg`
                    : String(numVal);
                },
              },
              {
                key: "revenue",
                label: t("common.revenue"),
                align: "right",
                format: (val: unknown) => formatCurrency(val as number),
              },
              {
                key: "share",
                label: t("reports.share"),
                align: "right",
                format: (val: unknown) => `${(val as number).toFixed(1)}%`,
              },
            ]}
            data={pricingComparisonData as unknown as Record<string, unknown>[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
