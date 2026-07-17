"use client";

import { Phone, Mail, Wallet, Pencil, Trash2, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { CustomerListItem } from "./types";
import { statusGradient } from "./colors";
import { CustomerAvatar } from "./customer-avatar";
import { CustomerStatusBadge } from "./customer-status-badge";

interface CustomerCardProps {
  customer: CustomerListItem;
  onEdit: (customer: CustomerListItem) => void;
  onDelete: (customer: CustomerListItem) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function CustomerCard({
  customer,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: CustomerCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden",
        "ring-1 ring-foreground/10 shadow-sm",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-foreground/15",
        "animate-fade-in-up",
      )}
    >
      {/* Accent strip — colored by customer status */}
      <div
        className={cn(
          "h-1 w-full shrink-0 bg-gradient-to-r",
          statusGradient(customer.customerStatus),
        )}
      />

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {/* Top block: avatar + name + contact + notes + balance.
            Grows to fill so stats + actions align at the bottom. */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-start gap-3">
            <CustomerAvatar name={customer.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold leading-tight">
                  {customer.name}
                </h3>
                <CustomerStatusBadge status={customer.customerStatus} />
              </div>
              {customer.phone && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
            </div>
          </div>

          {customer.notes && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {customer.notes}
            </p>
          )}

          {customer.balance > 0 && (
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Wallet className="h-3 w-3" />
              {formatCurrency(customer.balance)}
            </div>
          )}
        </div>

        {/* Summary stats — uniform hierarchy */}
        <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-border/40 pt-3">
          <div>
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <ShoppingBag className="h-3 w-3" />
              {t("common.orders")}
            </p>
            <p className="mt-0.5 text-base font-bold tabular-nums">
              {customer.totalOrders}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("customers.sortSpent")}
            </p>
            <p className="mt-0.5 text-base font-bold tabular-nums">
              {customer.totalSpent > 0 ? formatCurrency(customer.totalSpent) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("customers.lastOrder")}
            </p>
            <p className="mt-0.5 text-sm font-medium tabular-nums">
              {customer.lastOrderDate ? formatDate(customer.lastOrderDate) : "—"}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        {(canEdit || canDelete) && (
          <div className="flex shrink-0 items-center justify-end gap-0.5 border-t border-border/40 pt-2 opacity-60 transition-opacity group-hover:opacity-100">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(customer);
                }}
                aria-label={t("customers.editCustomer")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(customer);
                }}
                aria-label={t("customers.deleteCustomer")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
