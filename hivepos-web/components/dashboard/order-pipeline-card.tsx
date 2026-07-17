"use client";

import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import type { OrderPipeline } from "./dashboard-types";

interface Props {
  pipeline: OrderPipeline;
}

export function OrderPipelineCard({ pipeline }: Props) {
  const { t } = useTranslation();

  const pipelineConfig = [
    { key: "RECEIVED", label: t("dashboard.received"), color: "bg-blue-500" },
    { key: "IN_PROGRESS", label: t("dashboard.inPipeline"), color: "bg-amber-500" },
    { key: "READY", label: t("dashboard.ready"), color: "bg-emerald-500" },
    { key: "DELIVERED", label: t("dashboard.delivered"), color: "bg-gray-400" },
  ] as const;

  const total = pipelineConfig.reduce((s, p) => s + pipeline[p.key], 0);

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-bold">{t("dashboard.orderPipeline")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.noPipelineOrders")}</p>
        ) : (
          <div className="space-y-3">
            {/* Visual bar */}
            <div className="flex h-6 rounded-full overflow-hidden bg-muted">
              {pipelineConfig.map((p) => {
                const count = pipeline[p.key];
                const pct = total > 0 ? (count / total) * 100 : 0;
                return pct > 0 ? (
                  <div key={p.key} className={`${p.color} transition-all`} style={{ width: `${pct}%` }} title={`${p.label}: ${count}`} />
                ) : null;
              })}
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-2">
              {pipelineConfig.map((p) => {
                const count = pipeline[p.key];
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={p.key} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${p.color} shrink-0`} />
                    <span className="text-xs text-muted-foreground truncate">{p.label}</span>
                    <span className="text-xs font-bold ml-auto">{count}</span>
                    <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
