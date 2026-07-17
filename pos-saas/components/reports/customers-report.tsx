"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, UserPlus, DollarSign, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { formatCurrency } from "@/lib/format";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";

interface CustomersReportProps {
  from: string;
  to: string;
}

interface CustomerReportSummary {
  totalCustomers: number;
  newCustomers: number;
  newInPeriod: number;
  returningInPeriod: number;
  avgSpendPerCustomer: number;
}

interface TopSpender {
  customerId: string;
  name: string;
  orders: number;
  totalSpent: number;
}

interface OutstandingBalance {
  customerId: string;
  name: string;
  phone: string;
  totalOutstanding: number;
  orderCount: number;
}

interface CustomerReportData {
  summary: CustomerReportSummary;
  topSpenders: TopSpender[];
  outstandingBalance: OutstandingBalance[];
}

export function CustomersReport({ from, to }: CustomersReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<CustomerReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<CustomerReportData>(`/api/reports/customers?from=${from}&to=${to}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { summary, topSpenders, outstandingBalance } = data;

  // Pre-compute ranks for top spenders
  const spendersWithRank = topSpenders.map((s, i) => ({ ...s, rank: i + 1 }));

  const topSpendersSummary = {
    rank: "",
    name: t("common.total"),
    orders: spendersWithRank.reduce((sum, s) => sum + s.orders, 0),
    totalSpent: spendersWithRank.reduce((sum, s) => sum + s.totalSpent, 0),
  };

  const outstandingSummary = {
    customerId: "",
    name: t("common.total"),
    phone: "",
    totalOutstanding: outstandingBalance.reduce((sum, s) => sum + s.totalOutstanding, 0),
    orderCount: outstandingBalance.reduce((sum, s) => sum + s.orderCount, 0),
  };

  const csvHeaders: Record<string, string> = {
    name: t("common.name"),
    orders: t("common.orders"),
    totalSpent: t("customersReport.totalSpent"),
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <StatCard
            title={t("customersReport.totalCustomers")}
            value={summary.totalCustomers}
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-50 dark:bg-blue-950/50"
            accentColor="bg-blue-500"
          />
        </div>
        <div>
          <StatCard
            title={t("customersReport.newThisPeriod")}
            value={summary.newInPeriod}
            icon={UserPlus}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50 dark:bg-emerald-950/50"
            accentColor="bg-emerald-500"
          />
        </div>
        <div>
          <StatCard
            title={t("customersReport.returning")}
            value={summary.returningInPeriod}
            icon={Users}
            iconColor="text-amber-600"
            iconBg="bg-amber-50 dark:bg-amber-950/50"
            accentColor="bg-amber-500"
          />
        </div>
        <div>
          <StatCard
            title={t("customersReport.avgSpend")}
            value={formatCurrency(summary.avgSpendPerCustomer)}
            icon={DollarSign}
            iconColor="text-purple-600"
            iconBg="bg-purple-50 dark:bg-purple-950/50"
            accentColor="bg-purple-500"
          />
        </div>
      </div>

      {/* Top Spenders Table */}
      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("customersReport.topSpenders")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCsv(
                  spendersWithRank.map((s) => ({ name: s.name, orders: s.orders, totalSpent: s.totalSpent })),
                  `customers-report-${from}-${to}.csv`,
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
                  spendersWithRank.map((s) => ({ name: s.name, orders: s.orders, totalSpent: s.totalSpent })),
                  `customers-report-${from}-${to}.xlsx`,
                  "Customers",
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
              onClick={() => exportToPdf("customers", from, to)}
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
                key: "rank",
                label: "#",
                align: "center",
              },
              {
                key: "name",
                label: t("common.name"),
                align: "left",
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
              { key: "orders", label: t("common.orders"), align: "right" },
              {
                key: "totalSpent",
                label: t("customersReport.totalSpent"),
                align: "right",
                format: (val: unknown) => formatCurrency(val as number),
              },
            ]}
            data={spendersWithRank as unknown as Record<string, unknown>[]}
            summaryRow={topSpendersSummary as unknown as Record<string, unknown>}
            summaryLabel={t("common.total")}
          />
        </CardContent>
      </Card>

      {/* Outstanding Balances Table */}
      {outstandingBalance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("customersReport.outstandingBalances")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportTable
              columns={[
                {
                  key: "name",
                  label: t("common.customer"),
                  align: "left",
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
                { key: "phone", label: t("common.phone"), align: "left" },
                {
                  key: "totalOutstanding",
                  label: t("customerDetails.outstanding"),
                  align: "right",
                  format: (val: unknown) => (
                    <span className="text-red-600 font-medium">
                      {formatCurrency(val as number)}
                    </span>
                  ),
                },
                { key: "orderCount", label: t("common.orders"), align: "right" },
              ]}
              data={outstandingBalance as unknown as Record<string, unknown>[]}
              summaryRow={outstandingSummary as unknown as Record<string, unknown>}
              summaryLabel={t("common.total")}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
