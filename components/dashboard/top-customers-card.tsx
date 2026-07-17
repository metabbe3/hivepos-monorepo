"use client";

import { useTranslation } from "@/hooks/use-translation";
import { formatCompactCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";
import type { TopCustomer } from "./dashboard-types";

interface TopCustomersCardProps {
  customers: TopCustomer[];
}

export function TopCustomersCard({ customers }: TopCustomersCardProps) {
  const { t } = useTranslation();

  if (!customers.length) {
    return (
      <Card className="border border-border/40 bg-card shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
              <Users className="h-4 w-4 text-amber-600" />
            </div>
            <CardTitle className="text-base font-bold">
              {t("dashboard.topCustomers")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyState
            title={t("dashboard.noOrders")}
            description={t("dashboard.noOrdersDesc")}
          />
        </CardContent>
      </Card>
    );
  }

  const maxSpent = Math.max(...customers.map((c) => c.totalSpent));

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
            <Users className="h-4 w-4 text-amber-600" />
          </div>
          <CardTitle className="text-base font-bold">
            {t("dashboard.topCustomers")}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {customers.map((customer, index) => {
            const widthPercent = maxSpent > 0 ? (customer.totalSpent / maxSpent) * 100 : 0;
            const medals = ["text-amber-500", "text-slate-400", "text-amber-700"];
            const medalColor = index < 3 ? medals[index] : "text-muted-foreground";

            return (
              <div key={customer.customerId} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold ${medalColor} w-4`}>
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {customer.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {customer.orders}x
                    </span>
                  </div>
                  <span className="text-sm font-bold shrink-0 ml-2">
                    {formatCompactCurrency(customer.totalSpent)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
