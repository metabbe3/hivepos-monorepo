"use client";

import {
  ShoppingCart,
  PackageOpen,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { formatCompactCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { Stats } from "./dashboard-types";

interface Props {
  stats: Stats;
}

function ChangeBadge({ changePercent }: { changePercent: number | null }) {
  if (changePercent == null) return null;
  const isPositive = changePercent >= 0;
  return (
    <Badge
      variant={isPositive ? "secondary" : "destructive"}
      className="gap-1 text-xs font-medium"
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isPositive ? "+" : ""}
      {changePercent.toFixed(1)}%
    </Badge>
  );
}

export function StatsCards({ stats }: Props) {
  const { t } = useTranslation();

  const activeOrders = stats.orderPipeline.RECEIVED + stats.orderPipeline.IN_PROGRESS;

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {/* Operations: Blue */}
      <div>
        <StatCard
          title={t("common.orders")}
          value={stats.todayOrders}
          icon={ShoppingCart}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          accentColor="bg-blue-500"
          subtitle={t("dashboard.subtitle.today")}
          sparkline={stats.sparkline}
          sparklineColor="#3b82f6"
          extra={
            <ChangeBadge changePercent={stats.comparison.orders.changePercent} />
          }
        />
      </div>
      {/* Financial: Emerald */}
      <div>
        <StatCard
          title="Omset"
          value={formatCompactCurrency(stats.todayOmset)}
          icon={BarChart3}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          accentColor="bg-emerald-500"
          subtitle={t("dashboard.subtitle.totalOrderValue")}
          size="lg"
          extra={<ChangeBadge changePercent={stats.omsetChange} />}
        />
      </div>
      {/* Operations: Blue */}
      <div>
        <StatCard
          title="Pesanan Aktif"
          value={activeOrders}
          icon={Activity}
          iconColor="text-blue-500"
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          accentColor="bg-blue-400"
          subtitle={t("dashboard.subtitle.queueAndProcess")}
        />
      </div>
      {/* Operations: Indigo */}
      <div>
        <StatCard
          title="Siap Ambil"
          value={stats.readyForPickup}
          icon={PackageOpen}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          accentColor="bg-indigo-500"
          subtitle={t("dashboard.subtitle.waitingPickup")}
        />
      </div>
      {/* Financial: Emerald */}
      <div>
        <StatCard
          title={t("common.revenue")}
          value={formatCompactCurrency(stats.todayRevenue)}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          accentColor="bg-emerald-500"
          subtitle={t("dashboard.subtitle.paymentsReceived")}
          size="lg"
          extra={
            <div className="flex items-center gap-1.5 flex-wrap">
              <ChangeBadge changePercent={stats.comparison.revenue.changePercent} />
              {stats.unpaidDelivered > 0 && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.unpaidDelivered} piutang
                </Badge>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
