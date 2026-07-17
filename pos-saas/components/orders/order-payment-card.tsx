"use client";

import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_STATUS_CONFIG } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";
import type { OrderDetail } from "./order-types";

interface Props {
  order: OrderDetail;
  isEmployee: boolean;
  onPay: () => void;
}

export function OrderPaymentCard({ order, isEmployee, onPay }: Props) {
  const { t } = useTranslation();
  const remaining = order.totalAmount - order.paidAmount;
  const cfg = PAYMENT_STATUS_CONFIG[order.paymentStatus];

  return (
    <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-emerald-600" />
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t("orderDetails.payment")}
          </h3>
          <Badge className={cn(cfg.color, "border-0")}>{t(cfg.labelKey)}</Badge>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("common.total")}</span>
            <span className="font-semibold">
              {formatCurrency(order.totalAmount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("orderDetails.paid")}</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {formatCurrency(order.paidAmount)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between items-baseline">
            <span className="font-medium">{t("orderDetails.remaining")}</span>
            <span
              className={cn(
                "text-xl font-bold",
                remaining > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
        {!isEmployee && remaining > 0 && (
          <Button
            onClick={onPay}
            className="w-full gap-1.5 bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 hover:shadow-lg hover:brightness-105"
            size="sm"
          >
            <Banknote className="h-4 w-4" />
            {t("orderDetails.recordPayment")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
