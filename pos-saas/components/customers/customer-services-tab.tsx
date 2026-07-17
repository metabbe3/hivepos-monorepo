"use client";

import { DataTableCard, type Column } from "@/components/shared/data-table-card";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { CustomerStats } from "./types";

interface CustomerServicesTabProps {
  stats: CustomerStats | null;
  hasDateFilter: boolean;
}

export function CustomerServicesTab({
  stats,
  hasDateFilter,
}: CustomerServicesTabProps) {
  const { t } = useTranslation();
  const items = stats?.serviceBreakdown ?? [];
  const totalSpent = stats?.totalSpent ?? 0;

  const columns: Column<(typeof items)[number]>[] = [
    {
      header: t("common.service"),
      render: (s) => s.name,
      className: "font-medium",
    },
    {
      header: t("customerDetails.timesOrdered"),
      align: "right",
      render: (s) => s.orderCount,
      className: "tabular-nums",
    },
    {
      header: t("customerDetails.totalRevenue"),
      align: "right",
      render: (s) => formatCurrency(s.totalRevenue),
      className: "tabular-nums",
    },
    {
      header: t("customerDetails.percentOfTotal"),
      align: "right",
      render: (s) =>
        totalSpent > 0
          ? `${((s.totalRevenue / totalSpent) * 100).toFixed(1)}%`
          : "—",
      className: "tabular-nums text-muted-foreground",
    },
  ];

  return (
    <DataTableCard
      title={t("customerDetails.servicePreferences")}
      columns={columns}
      rows={items}
      rowKey={(s) => s.serviceId}
      emptyMessage={t("customerDetails.noServiceData")}
      emptyFilteredMessage={t("customerDetails.noServiceDataPeriod")}
      isFiltered={hasDateFilter}
    />
  );
}
