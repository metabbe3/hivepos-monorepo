"use client";

import { AlertTriangle, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import Link from "next/link";
import type { LowStockItem } from "./dashboard-types";

interface Props {
  lowStock: LowStockItem[];
}

export function LowStockCard({ lowStock }: Props) {
  const { t } = useTranslation();

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/40">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
            <CardTitle className="text-base font-bold">{t("dashboard.lowStock")}</CardTitle>
            {lowStock.length > 0 && (
              <Badge variant="destructive" className="text-xs">{lowStock.length}</Badge>
            )}
          </div>
          {lowStock.length > 0 && (
            <Link href="/laundry/inventory">
              <Button variant="ghost" size="sm" className="text-xs h-7">
                {t("dashboard.viewInventory")}
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {lowStock.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Package className="h-4 w-4 text-emerald-500" />
            <span>{t("dashboard.noLowStock")}</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {lowStock.slice(0, 5).map((item) => {
              const ratio = Number(item.lowStockThreshold) > 0
                ? Number(item.currentQuantity) / Number(item.lowStockThreshold)
                : 0;
              const barColor =
                ratio <= 0.25
                  ? "bg-red-500"
                  : ratio <= 0.5
                    ? "bg-amber-500"
                    : "bg-emerald-500";

              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {item.currentQuantity}/{item.lowStockThreshold} {item.unit}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all`}
                        style={{
                          width: `${Math.min(100, ratio * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
