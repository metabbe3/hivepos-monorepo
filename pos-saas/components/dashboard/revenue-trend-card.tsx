"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "@/hooks/use-translation";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { ChartTooltip } from "./chart-tooltip";
import type { RevenueTrendPoint } from "./dashboard-types";

interface RevenueTrendCardProps {
  data: RevenueTrendPoint[];
  granularity: "daily" | "weekly" | "monthly";
  onGranularityChange: (g: "daily" | "weekly" | "monthly") => void;
}

function formatShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

const GRANULARITIES = ["daily", "weekly", "monthly"] as const;

export function RevenueTrendCard({
  data,
  granularity,
  onGranularityChange,
}: RevenueTrendCardProps) {
  const { t } = useTranslation();

  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">
              {t("dashboard.revenueTrend")}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total: <span className="font-semibold text-foreground">{formatCurrency(totalRevenue)}</span>
            </p>
          </div>
        </div>
        <div className="flex rounded-lg border border-border/40 bg-muted/30 p-0.5">
          {GRANULARITIES.map((g) => (
            <button
              key={g}
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                granularity === g
                  ? "bg-popover text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onGranularityChange(g)}
            >
              {t(`dashboard.${g}`)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {!data.length ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            {t("dashboard.noTrendData")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="revenue" tickFormatter={(v) => formatShort(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                name={t("dashboard.thisPeriod")}
                stroke="#10b981"
                fill="url(#colorRevenue)"
                strokeWidth={2.5}
              />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="previousRevenue"
                name={t("dashboard.previousPeriod")}
                stroke="#94a3b8"
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={1.5}
              />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                name={t("dashboard.ordersLabel")}
                stroke="#3b82f6"
                strokeDasharray="4 4"
                dot={false}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
