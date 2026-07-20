"use client";

import { Users, UserCheck, AlertTriangle, UserX, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import type { CustomerInsights } from "./dashboard-types";

interface Props {
  insights: CustomerInsights;
}

export function CustomerInsightsCard({ insights }: Props) {
  const { t } = useTranslation();

  const metrics = [
    {
      label: t("dashboard.totalCustomers"),
      value: insights.total,
      icon: Users,
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
      iconColor: "text-indigo-600",
      border: "border-indigo-200/60 dark:border-indigo-800/30",
    },
    {
      label: t("dashboard.newThisWeek"),
      value: insights.newThisWeek,
      icon: UserPlus,
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      iconColor: "text-emerald-600",
      border: "border-emerald-200/60 dark:border-emerald-800/30",
    },
    {
      label: t("dashboard.active"),
      value: insights.active,
      icon: UserCheck,
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      iconColor: "text-emerald-600",
      border: "border-emerald-200/60 dark:border-emerald-800/30",
    },
    {
      label: t("dashboard.atRisk"),
      value: insights.atRisk,
      icon: AlertTriangle,
      bg: "bg-amber-50 dark:bg-amber-950/30",
      iconColor: "text-amber-600",
      border: "border-amber-200/60 dark:border-amber-800/30",
    },
    {
      label: t("dashboard.lapsed"),
      value: insights.lapsed,
      icon: UserX,
      bg: "bg-red-50 dark:bg-red-950/30",
      iconColor: "text-red-600",
      border: "border-red-200/60 dark:border-red-800/30",
    },
  ];

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40">
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          <CardTitle className="text-base font-bold">
            {t("dashboard.customerInsights")}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className={`rounded-xl border ${m.border} ${m.bg} p-3 text-center space-y-1.5`}
              >
                <Icon className={`h-4 w-4 mx-auto ${m.iconColor}`} />
                <p className="text-xl font-bold">{m.value}</p>
                <p className="text-[11px] text-foreground/70 leading-tight">
                  {m.label}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
