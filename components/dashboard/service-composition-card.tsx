"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { ServiceBreakdown } from "./dashboard-types";

interface Props {
  services: ServiceBreakdown[];
}

const COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6",
  "#ef4444", "#06b6d4", "#ec4899", "#6366f1",
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { percent: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm">
      <p className="text-xs font-semibold">{d.name}</p>
      <p className="text-sm font-bold">{formatCurrency(d.value)}</p>
      <p className="text-xs text-muted-foreground">{d.payload.percent.toFixed(1)}%</p>
    </div>
  );
}

export function ServiceCompositionCard({ services }: Props) {
  const { t } = useTranslation();

  if (!services.length) return null;

  const total = services.reduce((s, svc) => s + svc.revenue, 0);

  // Group to top 6, rest as "Lainnya"
  const top6 = services.slice(0, 6);
  const rest = services.slice(6);
  const grouped = [...top6];
  if (rest.length > 0) {
    grouped.push({
      serviceId: "other",
      name: "Lainnya",
      orders: rest.reduce((s, r) => s + r.orders, 0),
      revenue: rest.reduce((s, r) => s + r.revenue, 0),
    });
  }

  const chartData = grouped.map((svc) => ({
    name: svc.name,
    value: svc.revenue,
    percent: total > 0 ? (svc.revenue / total) * 100 : 0,
  }));

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
            <PieChartIcon className="h-4 w-4 text-amber-600" />
          </div>
          <CardTitle className="text-base font-bold">
            {t("dashboard.serviceBreakdown")}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Donut chart with center text */}
          <div className="relative w-[180px] h-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-lg font-bold">{formatCompactCurrency(total)}</p>
              <p className="text-[11px] text-muted-foreground">total</p>
            </div>
          </div>
          {/* Legend */}
          <div className="flex-1 space-y-2 min-w-0 max-h-[180px] overflow-y-auto">
            {chartData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground truncate flex-1">{d.name}</span>
                <span className="text-xs font-semibold shrink-0">{d.percent.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
