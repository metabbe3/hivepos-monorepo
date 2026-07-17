"use client";

import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { PaymentMethodBreakdown } from "./dashboard-types";

interface Props {
  breakdown: PaymentMethodBreakdown[];
}

export function PaymentMethodsCard({ breakdown }: Props) {
  const { t } = useTranslation();

  if (breakdown.length === 0) return null;

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-bold">{t("dashboard.paymentMethods")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {breakdown.map((pm) => {
            const totalAll = breakdown.reduce((s, p) => s + p.total, 0);
            const pct = totalAll > 0 ? (pm.total / totalAll) * 100 : 0;
            return (
              <div key={pm.method} className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t(PAYMENT_METHOD_LABELS[pm.method] ?? pm.method)}</p>
                  <Badge variant="secondary" className="text-[10px]">{pm.count} {pm.count !== 1 ? t("dashboard.payments") : t("dashboard.payment")}</Badge>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
                <p className="text-lg font-bold">{formatCurrency(pm.total)}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
