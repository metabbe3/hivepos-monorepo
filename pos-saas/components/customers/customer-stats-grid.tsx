"use client";

import {
  ShoppingCart,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Calendar,
  Clock,
  Wallet,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { LucideIcon } from "lucide-react";
import type { CustomerStats } from "./types";

interface CustomerStatsGridProps {
  stats: CustomerStats;
  balance: number;
  canTopUp: boolean;
  onTopUp: () => void;
}

interface HeroStatProps {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  hint?: string;
}

function HeroStat({ icon: Icon, iconClass, label, value, hint }: HeroStatProps) {
  return (
    <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            iconClass,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 truncate text-2xl font-bold tabular-nums">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

interface CompactStatProps {
  icon: LucideIcon;
  label: string;
  value: string;
  valueClass?: string;
}

function CompactStat({ icon: Icon, label, value, valueClass }: CompactStatProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-1 text-base font-semibold tabular-nums",
          valueClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function CustomerStatsGrid({
  stats,
  balance,
  canTopUp,
  onTopUp,
}: CustomerStatsGridProps) {
  const { t } = useTranslation();
  const hasOutstanding = stats.outstandingBalance > 0;

  return (
    <div className="space-y-3">
      {/* Hero row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <HeroStat
          icon={DollarSign}
          iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
          label={t("customerDetails.totalSpent")}
          value={formatCurrency(stats.totalSpent)}
        />
        <HeroStat
          icon={ShoppingCart}
          iconClass="bg-primary/10 text-primary"
          label={t("common.orders")}
          value={String(stats.totalOrders)}
        />
      </div>

      {/* Secondary row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <CompactStat
          icon={AlertCircle}
          label={t("customerDetails.outstanding")}
          value={formatCurrency(stats.outstandingBalance)}
          valueClass={
            hasOutstanding
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-400"
          }
        />
        <CompactStat
          icon={TrendingUp}
          label={t("customerDetails.avgOrder")}
          value={formatCurrency(stats.avgOrderValue)}
        />
        <CompactStat
          icon={Calendar}
          label={t("customerDetails.lastVisit")}
          value={
            stats.daysSinceLastOrder !== null
              ? t("customerDetails.daysAgo").replace("{days}", String(stats.daysSinceLastOrder))
              : "—"
          }
        />
        <CompactStat
          icon={Clock}
          label={t("customerDetails.avgBetween")}
          value={
            stats.avgDaysBetweenOrders !== null
              ? t("customerDetails.days").replace("{days}", String(stats.avgDaysBetweenOrders))
              : "—"
          }
        />
      </div>

      {/* Wallet card with CTA */}
      {canTopUp && (
        <Card className="overflow-hidden rounded-xl border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-emerald-100/60 shadow-sm dark:border-emerald-800/40 dark:from-emerald-950/40 dark:to-emerald-900/20">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-sm">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
                  {t("deposit.walletBalance")}
                </p>
                <p className="text-xl font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
                  {formatCurrency(balance)}
                </p>
              </div>
            </div>
            <Button
              onClick={onTopUp}
              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("deposit.topUpButton")}</span>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
