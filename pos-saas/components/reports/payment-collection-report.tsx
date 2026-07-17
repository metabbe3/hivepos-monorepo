"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  AlertCircle,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/shared/loading";
import { ReportTable } from "@/components/shared/report-table";
import { StatCard } from "@/components/shared/stat-card";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToCsv, exportToXls, exportToPdf } from "@/lib/export-utils";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";

interface PaymentCollectionReportProps {
  from: string;
  to: string;
}

interface PaymentEntry {
  paymentId: string;
  amount: number;
  paymentDate: string;
  orderNumber: string;
  orderId: string;
  customerName: string;
  customerId: string;
  customerPhone: string;
  orderCreatedDate: string;
}

interface PaymentMonthGroup {
  month: string;
  paymentCount: number;
  totalCollected: number;
  orderCount: number;
  payments: PaymentEntry[];
}

interface UnpaidMonthGroup {
  month: string;
  count: number;
  totalOutstanding: number;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    outstanding: number;
    createdAt: string;
    customerName: string;
    customerId: string;
    customerPhone: string;
  }>;
}

interface PaymentCollectionData {
  summary: {
    totalCollected: number;
    totalUnpaidOrders: number;
    totalOutstanding: number;
    oldestUnpaid: string | null;
  };
  paymentsCollectedByMonth: PaymentMonthGroup[];
  unpaidByMonth: UnpaidMonthGroup[];
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function PaymentCollectionReport({ from, to }: PaymentCollectionReportProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<PaymentCollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedAges, setExpandedAges] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<PaymentCollectionData>(`/api/reports/payment-collection?from=${from}&to=${to}`)
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

  const { summary, paymentsCollectedByMonth, unpaidByMonth } = data;
  const baseFilename = `payment-collection-${from}-to-${to}`;

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const toggleUnpaidMonth = (month: string) => {
    setExpandedAges((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  // Flatten data for CSV/XLS export
  const unpaidExportData = unpaidByMonth.flatMap((m) =>
    m.orders.map((o) => ({
      month: formatMonth(m.month),
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      totalAmount: o.totalAmount,
      paidAmount: o.paidAmount,
      outstanding: o.outstanding,
      createdAt: formatDate(o.createdAt),
    })),
  );

  const unpaidExportHeaders: Record<string, string> = {
    month: t("common.month"),
    orderNumber: t("common.order"),
    customerName: t("common.customer"),
    customerPhone: t("common.phone"),
    totalAmount: t("paymentCollectionReport.totalAmount"),
    paidAmount: t("paymentCollectionReport.paidAmount"),
    outstanding: t("paymentCollectionReport.outstanding"),
    createdAt: t("common.date"),
  };

  // Column definitions for order detail tables
  const orderColumns = [
    {
      key: "orderNumber",
      label: t("common.order"),
      format: (v: unknown, row: Record<string, unknown>) => (
        <Link href={`/laundry/orders/${row.orderId}`} className="text-primary hover:underline">
          {v as string}
        </Link>
      ),
    },
    {
      key: "customerName",
      label: t("common.customer"),
      format: (v: unknown, row: Record<string, unknown>) => (
        <Link href={`/customers/${row.customerId}`} className="text-primary hover:underline">
          {v as string}
        </Link>
      ),
    },
    {
      key: "createdAt",
      label: t("common.date"),
      format: (v: unknown) => formatDate(v as string),
    },
    {
      key: "totalAmount",
      label: t("paymentCollectionReport.totalAmount"),
      align: "right" as const,
      format: (v: unknown) => formatCurrency(v as number),
    },
    {
      key: "paidAmount",
      label: t("paymentCollectionReport.paidAmount"),
      align: "right" as const,
      format: (v: unknown) => formatCurrency(v as number),
    },
    {
      key: "outstanding",
      label: t("paymentCollectionReport.outstanding"),
      align: "right" as const,
      format: (v: unknown) => (
        <span className="font-medium text-red-600">{formatCurrency(v as number)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("paymentCollectionReport.collectedThisPeriod")}
          value={formatCurrency(summary.totalCollected)}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50 dark:bg-green-950/50"
          accentColor="bg-green-500"
        />
        <StatCard
          title={t("paymentCollectionReport.unpaidOrders")}
          value={summary.totalUnpaidOrders}
          icon={AlertCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50 dark:bg-red-950/50"
          accentColor="bg-red-500"
        />
        <StatCard
          title={t("paymentCollectionReport.totalOutstanding")}
          value={formatCurrency(summary.totalOutstanding)}
          icon={DollarSign}
          iconColor="text-orange-600"
          iconBg="bg-orange-50 dark:bg-orange-950/50"
          accentColor="bg-orange-500"
        />
        <StatCard
          title={t("paymentCollectionReport.oldestUnpaid")}
          value={summary.oldestUnpaid ? formatDate(summary.oldestUnpaid) : "\u2014"}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          accentColor="bg-amber-500"
        />
      </div>

      {/* Section 1: Payments Collected This Period */}
      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>{t("paymentCollectionReport.paymentsCollectedThisPeriod")}</CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(unpaidExportData, `${baseFilename}.csv`, unpaidExportHeaders)}
            >
              <Download className="size-4" />
              {t("common.exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToXls(unpaidExportData, `${baseFilename}.xls`, "Payment Collection", unpaidExportHeaders)
              }
            >
              <FileSpreadsheet className="size-4" />
              {t("common.exportXls")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToPdf("payment-collection", from, to)}
            >
              <FileText className="size-4" />
              {t("common.exportPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentsCollectedByMonth.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              {t("paymentCollectionReport.noOldPayments")}
            </p>
          ) : (
            <div className="space-y-2">
              {paymentsCollectedByMonth.map((monthGroup) => (
                <div key={monthGroup.month} className="border rounded-lg">
                  {/* Collapsible month header */}
                  <button
                    type="button"
                    className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleMonth(monthGroup.month)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedMonths.has(monthGroup.month) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <h4 className="font-semibold">{formatMonth(monthGroup.month)}</h4>
                        <p className="text-sm text-muted-foreground">
                          {monthGroup.orderCount} {t("common.orders").toLowerCase()} &middot;{" "}
                          {monthGroup.paymentCount} {t("common.payments").toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(monthGroup.totalCollected)}
                    </p>
                  </button>

                  {/* Expanded payment details */}
                  {expandedMonths.has(monthGroup.month) && (
                    <div className="border-t p-4 bg-muted/30">
                      <ReportTable
                        columns={[
                          {
                            key: "paymentDate",
                            label: t("common.date"),
                            format: (v: unknown) => formatDate(v as string),
                          },
                          {
                            key: "orderNumber",
                            label: t("common.order"),
                            format: (v: unknown, row: Record<string, unknown>) => (
                              <Link
                                href={`/laundry/orders/${row.orderId}`}
                                className="text-primary hover:underline"
                              >
                                {v as string}
                              </Link>
                            ),
                          },
                          {
                            key: "customerName",
                            label: t("common.customer"),
                            format: (v: unknown, row: Record<string, unknown>) => (
                              <Link
                                href={`/customers/${row.customerId}`}
                                className="text-primary hover:underline"
                              >
                                {v as string}
                              </Link>
                            ),
                          },
                          { key: "customerPhone", label: t("common.phone") },
                          {
                            key: "amount",
                            label: t("common.amount"),
                            align: "right" as const,
                            format: (v: unknown) => (
                              <span className="font-medium text-green-600">
                                {formatCurrency(v as number)}
                              </span>
                            ),
                          },
                        ]}
                        data={monthGroup.payments as unknown as Record<string, unknown>[]}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Unpaid Orders by Month */}
      <Card>
        <CardHeader>
          <CardTitle>{t("paymentCollectionReport.unpaidOrdersByAge")}</CardTitle>
        </CardHeader>
        <CardContent>
          {unpaidByMonth.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              {t("paymentCollectionReport.noOldPayments")}
            </p>
          ) : (
            <div className="space-y-2">
              {unpaidByMonth.map((monthGroup) => (
                <div key={monthGroup.month} className="border rounded-lg">
                  {/* Collapsible month header */}
                  <button
                    type="button"
                    className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleUnpaidMonth(monthGroup.month)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedAges.has(monthGroup.month) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <h4 className="font-semibold">{formatMonth(monthGroup.month)}</h4>
                        <p className="text-sm text-muted-foreground">
                          {monthGroup.count} {t("common.orders").toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(monthGroup.totalOutstanding)}
                    </p>
                  </button>

                  {/* Expanded order details */}
                  {expandedAges.has(monthGroup.month) && (
                    <div className="border-t p-4 bg-muted/30">
                      <ReportTable
                        columns={orderColumns}
                        data={monthGroup.orders as unknown as Record<string, unknown>[]}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
