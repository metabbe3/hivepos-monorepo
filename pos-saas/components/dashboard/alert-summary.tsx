"use client";

import { AlertTriangle, Package, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { UnpaidOrder, LowStockItem } from "./dashboard-types";

interface Props {
  unpaidOrders: UnpaidOrder[];
  lowStock: LowStockItem[];
}

export function AlertSummary({ unpaidOrders, lowStock }: Props) {
  const { t } = useTranslation();

  const totalUnpaid = unpaidOrders.reduce((s, o) => s + o.totalAmount, 0);
  const overdueUnpaid = unpaidOrders.filter((o) => {
    const days = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return days > 3;
  }).length;

  const alerts: { type: "danger" | "warning" | "info"; icon: typeof AlertTriangle; text: string; count: number }[] = [];

  if (unpaidOrders.length > 0) {
    alerts.push({
      type: overdueUnpaid > 0 ? "danger" : "warning",
      icon: AlertTriangle,
      text: `${unpaidOrders.length} piutang (${formatCurrency(totalUnpaid)})`,
      count: unpaidOrders.length,
    });
  }

  if (lowStock.length > 0) {
    alerts.push({
      type: "warning",
      icon: Package,
      text: `${lowStock.length} stok rendah`,
      count: lowStock.length,
    });
  }

  if (alerts.length === 0) return null;

  const styles = {
    danger: "bg-red-50 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/40 text-red-700 dark:text-red-300",
    warning: "bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-300",
    info: "bg-blue-50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300",
  };

  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((alert, i) => {
        const Icon = alert.icon;
        return (
          <div
            key={i}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${styles[alert.type]}`}
          >
            <Icon className="h-4 w-4" />
            <span>{alert.text}</span>
          </div>
        );
      })}
    </div>
  );
}
