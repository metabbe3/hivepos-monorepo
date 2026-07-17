"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTableCard, type Column } from "@/components/shared/data-table-card";
import { formatCurrency, formatDate } from "@/lib/format";
import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";
import type { CustomerOrder } from "./types";

interface CustomerOrdersTabProps {
  orders: CustomerOrder[];
  hasDateFilter: boolean;
}

export function CustomerOrdersTab({
  orders,
  hasDateFilter,
}: CustomerOrdersTabProps) {
  const { t } = useTranslation();

  const columns: Column<CustomerOrder>[] = [
    {
      header: t("customerDetails.orderNumber"),
      render: (order) => (
        <Link
          href={`/laundry/orders/${order.id}`}
          className="font-medium text-brand-600 hover:underline dark:text-brand-500"
        >
          {order.orderNumber}
        </Link>
      ),
    },
    {
      header: t("common.date"),
      render: (order) => formatDate(order.createdAt),
      className: "text-muted-foreground",
    },
    {
      header: t("common.items"),
      align: "right",
      render: (order) => order.orderItems?.length ?? "—",
      className: "tabular-nums",
    },
    {
      header: t("common.total"),
      align: "right",
      render: (order) => formatCurrency(order.totalAmount),
      className: "font-medium tabular-nums",
    },
    {
      header: t("common.status"),
      align: "center",
      render: (order) => {
        const cfg = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG];
        return (
          <Badge className={cfg?.color}>
            {t(cfg?.labelKey ?? order.status)}
          </Badge>
        );
      },
    },
    {
      header: t("common.payment"),
      align: "center",
      render: (order) => {
        const cfg = PAYMENT_STATUS_CONFIG[order.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG];
        return (
          <Badge className={cfg?.color}>
            {t(cfg?.labelKey ?? order.paymentStatus)}
          </Badge>
        );
      },
    },
  ];

  return (
    <DataTableCard
      title={t("customerDetails.orderHistory")}
      columns={columns}
      rows={orders}
      rowKey={(order) => order.id}
      emptyMessage={t("customerDetails.noOrders")}
      emptyFilteredMessage={t("customerDetails.noOrdersPeriod")}
      isFiltered={hasDateFilter}
    />
  );
}
