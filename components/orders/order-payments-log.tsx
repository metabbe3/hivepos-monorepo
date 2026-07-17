"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";
import type { OrderPayment } from "./order-types";

interface Props {
  payments: OrderPayment[];
}

export function OrderPaymentsLog({ payments }: Props) {
  const { t } = useTranslation();
  if (payments.length === 0) return null;

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">
          {t("orderDetails.paymentHistory")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {payments.map((p) => (
          <div
            key={p.id}
            className="rounded-lg bg-muted/30 border border-border/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                {formatCurrency(p.amount)}
              </span>
              <Badge variant="outline" className="text-xs">
                {t(
                  PAYMENT_METHOD_LABELS[
                    p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS
                  ] ?? p.paymentMethod,
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDateTime(p.paidAt)}
            </p>
            {p.notes && (
              <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
