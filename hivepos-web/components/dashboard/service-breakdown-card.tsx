"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Sparkles } from "lucide-react";
import { ChartTooltip } from "./chart-tooltip";
import type { ServiceBreakdown } from "./dashboard-types";

interface ServiceBreakdownCardProps {
  services: ServiceBreakdown[];
}

export function ServiceBreakdownCard({
  services,
}: ServiceBreakdownCardProps) {
  const { t } = useTranslation();

  if (!services.length) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            {t("dashboard.serviceBreakdown")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title={t("dashboard.noServiceData")}
            description={t("dashboard.noServiceDataDesc")}
          />
        </CardContent>
      </Card>
    );
  }

  const topServices = services.slice(0, 10);
  const height = Math.min(services.length, 10) * 45 + 40;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          {t("dashboard.serviceBreakdown")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={topServices} layout="vertical" barCategoryGap={8}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) =>
                value.length > 12 ? `${value.slice(0, 12)}...` : value
              }
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              dataKey="revenue"
              fill="#6366f1"
              radius={[0, 4, 4, 0]}
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
