"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "@/hooks/use-translation";
import { formatCompactCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { ChartTooltip } from "./chart-tooltip";
import type { CashFlow } from "./dashboard-types";

interface CashFlowCardProps {
  cashFlow: CashFlow;
}

export function CashFlowCard({ cashFlow }: CashFlowCardProps) {
  const { t } = useTranslation();
  const { income, expenses, net, walletDeposits } = cashFlow;

  const chartData = [
    { name: t("dashboard.income"), value: income, fill: "#10b981" },
    { name: t("dashboard.expenses"), value: expenses, fill: "#ef4444" },
    {
      name: t("dashboard.netCashFlow"),
      value: net,
      fill: net >= 0 ? "#10b981" : "#ef4444",
    },
    {
      name: t("dashboard.walletDeposits"),
      value: walletDeposits,
      fill: "#6366f1",
    },
  ];

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">
              {t("dashboard.cashFlow")}
            </CardTitle>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">Net:</span>
              <span className={`text-sm font-bold ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatCompactCurrency(net)}
              </span>
              {net >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/30 p-3 space-y-1">
            <div className="flex items-center gap-1 text-emerald-600">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{t("dashboard.income")}</span>
            </div>
            <p className="text-lg font-bold">{formatCompactCurrency(income)}</p>
          </div>
          <div className="rounded-xl border border-red-200/60 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/30 p-3 space-y-1">
            <div className="flex items-center gap-1 text-red-600">
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{t("dashboard.expenses")}</span>
            </div>
            <p className="text-lg font-bold">{formatCompactCurrency(expenses)}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-blue-200/60 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800/30 p-3 space-y-1">
            <div className="flex items-center gap-1 text-blue-600">
              <Wallet className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{t("dashboard.walletDeposits")}</span>
            </div>
            <p className="text-lg font-bold">{formatCompactCurrency(walletDeposits)}</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} barCategoryGap={8}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
