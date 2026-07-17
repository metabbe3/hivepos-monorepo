"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { OrderItem } from "./order-types";

interface Props {
  items: OrderItem[];
  totalPcs: number;
}

export function OrderItemsTable({ items, totalPcs }: Props) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">
          {t("orderDetails.items")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop: real table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-muted-foreground border-b border-border/60">
                <th className="py-2 pr-3 text-left">
                  {t("common.service")}
                </th>
                <th className="py-2 px-3 text-right whitespace-nowrap">
                  {t("reports.qtyOrWeight")}
                </th>
                <th className="py-2 px-3 text-right whitespace-nowrap">
                  {t("reports.avgValue")}
                </th>
                <th className="py-2 pl-3 text-right whitespace-nowrap">
                  {t("reports.totalAmount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border/40 last:border-0 align-top"
                >
                  <td className="py-3 pr-3">
                    <p className="font-medium">{item.serviceName}</p>
                    {item.garmentBreakdown && item.garmentBreakdown.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.garmentBreakdown.map((g, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-300"
                          >
                            {g.name}: {g.qty}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.notes}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                    {item.weightKg
                      ? `${item.weightKg} ${t("newOrder.kg")}`
                      : `${item.quantity} ${t("orders.items")}`}
                  </td>
                  <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                    {formatCurrency(item.pricePerUnit)}
                  </td>
                  <td className="py-3 pl-3 text-right font-semibold whitespace-nowrap">
                    {formatCurrency(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: card list */}
        <div className="md:hidden space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg bg-muted/30 border border-border/40 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium flex-1">{item.serviceName}</p>
                <span className="font-semibold whitespace-nowrap">
                  {formatCurrency(item.subtotal)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(item.pricePerUnit)} ×{" "}
                {item.weightKg
                  ? `${item.weightKg} ${t("newOrder.kg")}`
                  : `${item.quantity} ${t("orders.items")}`}
              </p>
              {item.garmentBreakdown && item.garmentBreakdown.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {item.garmentBreakdown.map((g, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-300"
                    >
                      {g.name}: {g.qty}
                    </span>
                  ))}
                </div>
              )}
              {item.notes && (
                <p className="text-xs text-muted-foreground mt-1">
                  {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>

        {totalPcs > 0 && (
          <div className="flex justify-between text-xs mt-3 text-muted-foreground">
            <span>
              {t("garment.totalItems").replace("{count}", String(totalPcs))}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
