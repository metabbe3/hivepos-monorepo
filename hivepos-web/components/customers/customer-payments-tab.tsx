"use client";

import Link from "next/link";
import { DataTableCard, type Column } from "@/components/shared/data-table-card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";
import type { CustomerStats, PaymentHistoryRow } from "./types";

interface CustomerPaymentsTabProps {
  payments: PaymentHistoryRow[];
  stats: CustomerStats | null;
  hasDateFilter: boolean;
}

export function CustomerPaymentsTab({
  payments,
  stats,
  hasDateFilter,
}: CustomerPaymentsTabProps) {
  const { t } = useTranslation();
  const methods = stats?.paymentMethodBreakdown ?? [];

  const columns: Column<PaymentHistoryRow>[] = [
    {
      header: t("common.date"),
      render: (p) => formatDateTime(p.createdAt),
      className: "text-muted-foreground",
    },
    {
      header: t("receipt.order"),
      render: (p) => (
        <Link
          href={`/laundry/orders/${p.orderId}`}
          className="font-medium text-brand-600 hover:underline dark:text-brand-500"
        >
          {p.orderNumber}
        </Link>
      ),
    },
    {
      header: t("customerDetails.method"),
      render: (p) =>
        t(
          PAYMENT_METHOD_LABELS[p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ??
            p.paymentMethod,
        ),
    },
    {
      header: t("common.amount"),
      align: "right",
      render: (p) => formatCurrency(p.amount),
      className: "font-medium tabular-nums",
    },
    {
      header: t("common.notes"),
      render: (p) => p.notes || "—",
      className: "max-w-[200px] truncate text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-4">
      {methods.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {methods.map((pm) => (
            <div
              key={pm.method}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-medium">
                  {t(
                    PAYMENT_METHOD_LABELS[pm.method as keyof typeof PAYMENT_METHOD_LABELS] ??
                      pm.method,
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("customerDetails.paymentCount").replace("{count}", String(pm.count))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrency(pm.total)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <DataTableCard
        title={t("customerDetails.paymentHistory")}
        columns={columns}
        rows={payments}
        rowKey={(p) => p.id}
        emptyMessage={t("customerDetails.noPayments")}
        emptyFilteredMessage={t("customerDetails.noPaymentsPeriod")}
        isFiltered={hasDateFilter}
      />
    </div>
  );
}
