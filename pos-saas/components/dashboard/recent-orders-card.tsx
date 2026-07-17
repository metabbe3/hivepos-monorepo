"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { ORDER_STATUS_CONFIG } from "@/lib/constants";
import Link from "next/link";
import type { RecentOrder } from "./dashboard-types";

interface Props {
  orders: RecentOrder[];
  onCreateOrder: () => void;
}

export function RecentOrdersCard({ orders, onCreateOrder }: Props) {
  const { t } = useTranslation();

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">{t("dashboard.recentOrders")}</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <EmptyState
            title={t("dashboard.noOrdersYet")}
            description={t("dashboard.yourOrderHistory")}
            action={{ label: t("dashboard.createOrder"), onClick: onCreateOrder }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dashboard.orderNumber")}</TableHead>
                <TableHead>{t("common.customer")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.total")}</TableHead>
                <TableHead className="text-right hidden sm:table-cell">{t("common.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link href={`/laundry/orders/${order.id}`} className="font-medium text-primary hover:underline">
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.color ?? "bg-gray-100 text-gray-800"}`}>
                      {t(ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.labelKey ?? order.status.replace(/_/g, " "))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(order.totalAmount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                    {new Date(order.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
