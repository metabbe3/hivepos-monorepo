"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, Zap } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export interface TurnaroundData {
  avgHours: number | null;
  fastestHours: number | null;
  slowestHours: number | null;
  completedCount: number;
}

function formatHours(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}j ${m}m` : `${h}j`;
}

interface Props {
  data: TurnaroundData;
}

export function TurnaroundCard({ data }: Props) {
  const { t } = useTranslation();

  if (data.completedCount === 0) return null;

  const metrics = [
    {
      label: t("dashboard.turnaround.avg"),
      value: formatHours(data.avgHours),
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200/60 dark:border-blue-800/30",
    },
    {
      label: t("dashboard.turnaround.fastest"),
      value: formatHours(data.fastestHours),
      icon: Zap,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-200/60 dark:border-emerald-800/30",
    },
    {
      label: t("dashboard.turnaround.slowest"),
      value: formatHours(data.slowestHours),
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200/60 dark:border-amber-800/30",
    },
  ];

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40">
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <CardTitle className="text-base font-bold">{t("dashboard.turnaround.title")}</CardTitle>
          <span className="text-xs text-muted-foreground">{data.completedCount} completed</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className={`rounded-xl border ${m.border} ${m.bg} p-3 text-center space-y-1.5`}
              >
                <Icon className={`h-4 w-4 mx-auto ${m.color}`} />
                <p className="text-xl font-bold">{m.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{m.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
