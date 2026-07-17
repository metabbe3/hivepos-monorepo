"use client";

import Link from "next/link";
import { Phone, ChevronRight, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { OrderDetail } from "./order-types";

interface Props {
  order: OrderDetail;
}

export function OrderCustomerCard({ order }: Props) {
  const { t } = useTranslation();
  const initial = order.customerName.charAt(0).toUpperCase() || "?";

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          {t("orderDetails.customer")}
        </h3>
        <Link
          href={`/customers/${order.customerId}`}
          className="flex items-center gap-3 group"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-white text-base font-bold shadow-sm">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate group-hover:text-primary transition-colors">
              {order.customerName}
            </p>
            {order.customerPhone && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Phone className="h-3 w-3" />
                <span className="tabular-nums">{order.customerPhone}</span>
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </Link>
        {order.customerBalance > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              {t("deposit.walletBalance")}
            </span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(order.customerBalance)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
