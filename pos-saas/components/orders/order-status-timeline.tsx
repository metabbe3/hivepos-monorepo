"use client";

import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_CONFIG, ORDER_STATUS_FLOW } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { OrderDetail } from "./order-types";

interface Props {
  order: OrderDetail;
}

const STEP_DATES: Record<string, (o: OrderDetail) => string | null> = {
  RECEIVED: (o) => o.receivedAt || o.createdAt,
  IN_PROGRESS: (o) => o.inProgressAt,
  READY: (o) => o.readyAt,
  DELIVERED: (o) => o.deliveredAt,
};

export function OrderStatusTimeline({ order }: Props) {
  const { t } = useTranslation();
  const currentIdx = ORDER_STATUS_FLOW.indexOf(order.status);

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        {/* Desktop / tablet: horizontal stepper */}
        <div className="hidden sm:flex items-center">
          {ORDER_STATUS_FLOW.map((s, i) => {
            const done = i <= currentIdx;
            const dateStr = STEP_DATES[s](order);
            return (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                      done
                        ? "border-brand-600 bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/20"
                        : "border-muted bg-background text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-bold">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 text-xs font-medium whitespace-nowrap",
                      done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {t(ORDER_STATUS_CONFIG[s].labelKey)}
                  </span>
                  {dateStr && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(dateStr)}
                    </span>
                  )}
                </div>
                {i < ORDER_STATUS_FLOW.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 mx-2 flex-1 rounded-full transition-all",
                      i < currentIdx
                        ? "bg-gradient-to-r from-brand-600 to-brand-700"
                        : "bg-muted",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical stepper */}
        <div className="sm:hidden space-y-0">
          {ORDER_STATUS_FLOW.map((s, i) => {
            const done = i <= currentIdx;
            const isLast = i === ORDER_STATUS_FLOW.length - 1;
            const dateStr = STEP_DATES[s](order);
            return (
              <div key={s} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                      done
                        ? "border-brand-600 bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/20"
                        : "border-muted bg-background text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <span className="text-xs font-bold">{i + 1}</span>
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 grow my-1 rounded-full",
                        i < currentIdx ? "bg-brand-600" : "bg-muted",
                      )}
                      style={{ minHeight: "1.5rem" }}
                    />
                  )}
                </div>
                <div className={cn("pb-3", isLast && "pb-0")}>
                  <p
                    className={cn(
                      "text-sm font-medium leading-tight",
                      done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {t(ORDER_STATUS_CONFIG[s].labelKey)}
                  </p>
                  {dateStr && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(dateStr)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
