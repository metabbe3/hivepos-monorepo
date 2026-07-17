"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Users, Receipt, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { StatCard } from "@/components/shared/stat-card";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";

interface OutstandingReportProps {
  from: string;
  to: string;
}

interface OutstandingCustomer {
  customerId: string;
  name: string;
  phone: string;
  totalOutstanding: number;
  orderCount: number;
  oldestOrder: string;
}

interface OutstandingData {
  summary: {
    totalOutstanding: number;
    customersAffected: number;
    ordersAffected: number;
  };
  customers: OutstandingCustomer[];
}

export function OutstandingReport({ from, to }: OutstandingReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<OutstandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<OutstandingData>(`/api/reports/outstanding?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, customers } = data;
  const baseFilename = `outstanding-report-${from}-to-${to}`;

  const csvHeaders: Record<string, string> = {
    name: t("common.customer"),
    phone: t("common.phone"),
    totalOutstanding: t("customerDetails.outstanding"),
    orderCount: t("common.orders"),
    oldestOrder: t("reports.oldestUnpaid"),
  };

  const summaryRow = {
    customerId: "",
    name: t("common.total"),
    phone: "",
    totalOutstanding: summary.totalOutstanding,
    orderCount: summary.ordersAffected,
    oldestOrder: "",
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("outstandingReport.totalOutstanding")}
          value={formatCurrency(summary.totalOutstanding)}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50 dark:bg-red-950/50"
          accentColor="bg-red-500"
        />
        <StatCard
          title={t("outstandingReport.affectedCustomers")}
          value={summary.customersAffected}
          icon={Users}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          accentColor="bg-amber-500"
        />
        <StatCard
          title={t("outstandingReport.unpaidOrders")}
          value={summary.ordersAffected}
          icon={Receipt}
          iconColor="text-orange-600"
          iconBg="bg-orange-50 dark:bg-orange-950/50"
          accentColor="bg-orange-500"
        />
      </div>

      {/* Outstanding by Customer */}
      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("outstandingReport.balances")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => exportToCsv(
              customers.map((c) => ({
                name: c.name,
                phone: c.phone,
                totalOutstanding: c.totalOutstanding,
                orderCount: c.orderCount,
                oldestOrder: formatDate(c.oldestOrder),
              })),
              `${baseFilename}.csv`, csvHeaders,
            )}>
              <Download className="size-4" />
              {t("common.exportCsv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToXls(
              customers.map((c) => ({
                name: c.name,
                phone: c.phone,
                totalOutstanding: c.totalOutstanding,
                orderCount: c.orderCount,
                oldestOrder: formatDate(c.oldestOrder),
              })),
              `${baseFilename}.xls`, "Outstanding", csvHeaders,
            )}>
              <FileSpreadsheet className="size-4" />
              {t("common.exportXls")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPdf("outstanding", from, to)}>
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
                label: t("common.customer"),
                format: (v, row) => {
                  const id = (row as Record<string, unknown>).customerId as string;
                  if (!id) return v as string;
                  return (
                    <Link href={`/customers/${id}`} className="text-primary hover:underline">
                      {v as string}
                    </Link>
                  );
                },
              },
              { key: "phone", label: t("common.phone") },
              {
                key: "totalOutstanding",
                label: t("customerDetails.outstanding"),
                align: "right",
                format: (v) => (
                  <span className="font-medium text-red-600">{formatCurrency(v as number)}</span>
                ),
              },
              { key: "orderCount", label: t("common.orders"), align: "right" },
              {
                key: "oldestOrder",
                label: t("reports.oldestUnpaid"),
                align: "right",
                format: (v) => v ? formatDate(v as string) : "",
              },
            ]}
            data={customers as unknown as Record<string, unknown>[]}
            summaryRow={summaryRow as unknown as Record<string, unknown>}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
