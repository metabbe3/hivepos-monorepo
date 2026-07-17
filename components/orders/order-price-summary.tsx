"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";

interface Props {
  itemsSubtotal: number;
  discountAmount: number;
  discountType: string | null;
  totalAmount: number;
}

export function OrderPriceSummary({
  itemsSubtotal,
  discountAmount,
  discountType,
  totalAmount,
}: Props) {
  const { t } = useTranslation();
  const hasDiscount = discountAmount > 0;
  const discountPct =
    hasDiscount && discountType === "PERCENTAGE" && itemsSubtotal > 0
      ? Math.round((discountAmount / itemsSubtotal) * 100)
      : null;

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">
          {t("reports.totalAmount")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {t("orderDetails.subtotal")}
          </span>
          <span>{formatCurrency(itemsSubtotal)}</span>
        </div>
        {hasDiscount && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t("orderDetails.discount")}
              {discountPct ? ` (${discountPct}%)` : ` ${t("orderDetails.fixed")}`}
            </span>
            <span className="text-red-600 dark:text-red-400">
              -{formatCurrency(discountAmount)}
            </span>
          </div>
        )}
        <Separator className="my-1" />
        <div className="flex justify-between items-baseline">
          <span className="font-semibold">{t("common.total")}</span>
          <span className="text-2xl font-bold tracking-tight">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
