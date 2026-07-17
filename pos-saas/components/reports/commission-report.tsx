"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, HandCoins, TrendingUp, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { StatCard } from "@/components/shared/stat-card";
import { formatCurrency } from "@/lib/format";
import { COMMISSION_TYPE_LABELS, PRICING_TYPE_LABELS } from "@/lib/constants";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";

interface CommissionReportProps {
  from: string;
  to: string;
}

interface ServiceCommission {
  serviceId: string;
  name: string;
  pricingType: string;
  orderCount: number;
  revenue: number;
  commissionType: string;
  commissionValue: number;
  commission: number;
}

interface CommissionData {
  summary: { totalRevenue: number; totalCommission: number };
  byService: ServiceCommission[];
}

export function CommissionReport({ from, to }: CommissionReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<CommissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<CommissionData>(`/api/reports/commission?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, byService } = data;
  const commissionRate = summary.totalRevenue > 0
    ? ((summary.totalCommission / summary.totalRevenue) * 100).toFixed(1)
    : "0.0";

  const csvHeaders: Record<string, string> = {
    name: t("common.service"),
    pricingType: t("reports.type"),
    orderCount: t("common.orders"),
    revenue: t("common.revenue"),
    commissionType: t("reports.commissionType"),
    commissionValue: t("reports.commissionValue"),
    commission: t("reporting.commission"),
  };
  const baseFilename = `commission-report-${from}-to-${to}`;

  const summaryRow = {
    serviceId: "",
    name: t("common.total"),
    pricingType: "",
    orderCount: byService.reduce((sum, s) => sum + s.orderCount, 0),
    revenue: summary.totalRevenue,
    commissionType: "",
    commissionValue: 0,
    commission: summary.totalCommission,
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("commissionReport.totalRevenue")}
          value={formatCurrency(summary.totalRevenue)}
          icon={DollarSign}
          iconColor="text-amber-600"
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          accentColor="bg-amber-500"
        />
        <StatCard
          title={t("commissionReport.totalCommission")}
          value={formatCurrency(summary.totalCommission)}
          icon={HandCoins}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          accentColor="bg-emerald-500"
        />
        <StatCard
          title={t("commissionReport.commissionRate")}
          value={`${commissionRate}%`}
          icon={TrendingUp}
          iconColor="text-violet-600"
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          accentColor="bg-violet-500"
        />
      </div>

      {/* Commission Breakdown */}
      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("commissionReport.byService")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => exportToCsv(
              byService.map((s) => ({
                name: s.name,
                pricingType: t(PRICING_TYPE_LABELS[s.pricingType as keyof typeof PRICING_TYPE_LABELS] ?? s.pricingType),
                orderCount: s.orderCount,
                revenue: s.revenue,
                commissionType: t(COMMISSION_TYPE_LABELS[s.commissionType as keyof typeof COMMISSION_TYPE_LABELS]),
                commissionValue: s.commissionValue,
                commission: s.commission,
              })),
              `${baseFilename}.csv`, csvHeaders,
            )}>
              <Download className="size-4" />
              {t("common.exportCsv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToXls(
              byService.map((s) => ({
                name: s.name,
                pricingType: t(PRICING_TYPE_LABELS[s.pricingType as keyof typeof PRICING_TYPE_LABELS] ?? s.pricingType),
                orderCount: s.orderCount,
                revenue: s.revenue,
                commissionType: t(COMMISSION_TYPE_LABELS[s.commissionType as keyof typeof COMMISSION_TYPE_LABELS]),
                commissionValue: s.commissionValue,
                commission: s.commission,
              })),
              `${baseFilename}.xls`, "Commission", csvHeaders,
            )}>
              <FileSpreadsheet className="size-4" />
              {t("common.exportXls")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPdf("commission", from, to)}>
              <FileText className="size-4" />
              {t("common.exportPdf")}
            </Button>
          </div>
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
                align: "center",
                format: (v) => (
                  <Badge variant="outline">
                    {t(PRICING_TYPE_LABELS[v as keyof typeof PRICING_TYPE_LABELS] ?? String(v))}
                  </Badge>
                ),
              },
              { key: "orderCount", label: t("common.orders"), align: "right" },
              {
                key: "revenue",
                label: t("common.revenue"),
                align: "right",
                format: (v) => formatCurrency(v as number),
              },
              {
                key: "commissionType",
                label: t("reporting.commission"),
                align: "center",
                format: (v, row) => {
                  const type = v as string;
                  if (type === "NONE") return <span className="text-muted-foreground">{"\u2014"}</span>;
                  const val = (row as Record<string, unknown>).commissionValue as number;
                  return (
                    <Badge variant="secondary">
                      {type === "FLAT" ? formatCurrency(val) : `${val}%`}
                    </Badge>
                  );
                },
              },
              {
                key: "commission",
                label: t("reports.commissionEarned"),
                align: "right",
                format: (v) => (
                  <span className="font-medium text-emerald-600">{formatCurrency(v as number)}</span>
                ),
              },
            ]}
            data={byService as unknown as Record<string, unknown>[]}
            summaryRow={summaryRow as unknown as Record<string, unknown>}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
