"use client";

import {
  ShoppingCart,
  Package,
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

function ChangeBadge({
  changePercent,
  onBrand = false,
}: {
  changePercent: number | null;
  onBrand?: boolean;
}) {
  if (changePercent == null) return null;
  const isPositive = changePercent >= 0;
  const arrow = isPositive ? (
    <TrendingUp className="h-3 w-3" />
  ) : (
    <TrendingDown className="h-3 w-3" />
  );
  // ponytail: onBrand renders a translucent-white chip so the badge stays legible
  // on the indigo hero surface — the stock secondary/destructive Badge reads washed there.
  if (onBrand) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 text-xs font-medium text-white ring-1 ring-inset ring-white/20">
        {arrow}
        {isPositive ? "+" : ""}
        {changePercent.toFixed(1)}%
      </span>
    );
  }
  return (
    <Badge
      variant={isPositive ? "secondary" : "destructive"}
      className="gap-1 text-xs font-medium"
    >
      {arrow}
      {isPositive ? "+" : ""}
      {changePercent.toFixed(1)}%
    </Badge>
  );
}

export function StatsCards({ stats }: Props) {
  const { t } = useTranslation();

  const activeOrders = stats.orderPipeline.RECEIVED + stats.orderPipeline.IN_PROGRESS;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {/* Featured: today's omset — the business-critical metric, dominant tile */}
      <div className="col-span-2 lg:row-span-2">
        {/* Featured: today's omset — the business-critical metric.
            Hero = committed indigo surface so it owns the focal point of the dashboard. */}
        <StatCard
          title={t("dashboard.omset")}
          value={formatCompactCurrency(stats.todayOmset)}
          icon={BarChart3}
          subtitle={t("dashboard.subtitle.totalOrderValue")}
          size="lg"
          variant="hero"
          extra={<ChangeBadge onBrand changePercent={stats.omsetChange} />}
        />
      </div>
      {/* Orders — secondary, keeps the 7-day sparkline */}
      <StatCard
        title={t("common.orders")}
        value={stats.todayOrders}
        icon={ShoppingCart}
        iconColor="text-indigo-600"
        iconBg="bg-indigo-50 dark:bg-indigo-950/50"
        subtitle={t("dashboard.subtitle.today")}
        sparkline={stats.sparkline}
        sparklineColor="var(--color-brand)"
        extra={
          <ChangeBadge changePercent={stats.comparison.orders.changePercent} />
        }
      />
      {/* Revenue */}
      <StatCard
        title={t("common.revenue")}
        value={formatCompactCurrency(stats.todayRevenue)}
        icon={DollarSign}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-50 dark:bg-emerald-950/50"
        subtitle={t("dashboard.subtitle.paymentsReceived")}
        extra={
          <div className="flex items-center gap-1.5 flex-wrap">
            <ChangeBadge changePercent={stats.comparison.revenue.changePercent} />
            {stats.unpaidDelivered > 0 && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                {t("dashboard.unpaidCount").replace("{n}", String(stats.unpaidDelivered))}
              </Badge>
            )}
          </div>
        }
      />
      {/* Active orders */}
      <StatCard
        title={t("dashboard.activeOrders")}
        value={activeOrders}
        icon={Activity}
        iconColor="text-indigo-600"
        iconBg="bg-indigo-50 dark:bg-indigo-950/50"
        subtitle={t("dashboard.subtitle.queueAndProcess")}
      />
      {/* Ready for pickup — emerald (positive/ready state, matches pipeline READY) */}
      <StatCard
        title={t("dashboard.readyForPickup")}
        value={stats.readyForPickup}
        icon={Package}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-50 dark:bg-emerald-950/50"
        subtitle={t("dashboard.subtitle.waitingPickup")}
      />
    </div>
  );
}
