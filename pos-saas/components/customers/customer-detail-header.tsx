"use client";

import Link from "next/link";
import {
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  Wallet,
  Pencil,
  RefreshCw,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { CustomerDetail, CustomerStats } from "./types";
import { statusGradient } from "./colors";
import { CustomerAvatar } from "./customer-avatar";
import { CustomerStatusBadge } from "./customer-status-badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface CustomerDetailHeaderProps {
  customer: CustomerDetail;
  stats: CustomerStats | null;
  spinning: boolean;
  onEdit: () => void;
  onRefresh: () => void;
  onTopUp: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
  canTopUp: boolean;
}

export function CustomerDetailHeader({
  customer,
  stats,
  spinning,
  onEdit,
  onRefresh,
  onTopUp,
  onDelete,
  canEdit,
  canDelete,
  canTopUp,
}: CustomerDetailHeaderProps) {
  const { t } = useTranslation();
  const status = stats?.customerStatus;

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-xl border-border/60 shadow-sm",
      )}
    >
      {/* Accent strip colored by status (neutral if stats not loaded yet) */}
      <div
        className={cn(
          "h-1.5 w-full bg-gradient-to-r",
          status ? statusGradient(status) : "from-border to-border",
        )}
      />
      <CardContent className="p-4 sm:p-5">
        {/* Breadcrumb */}
        <nav className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Link
            href="/customers"
            className="hover:text-foreground transition-colors"
          >
            {t("customers.title")}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">{customer.name}</span>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <CustomerAvatar name={customer.name} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold leading-tight">
                {customer.name}
              </h1>
              {status && <CustomerStatusBadge status={status} />}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{customer.phone}</span>
                </a>
              )}
              {customer.email && (
                <a
                  href={`mailto:${customer.email}`}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{customer.email}</span>
                </a>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {t("customerDetails.memberSince")} {formatDate(customer.createdAt)}
              </span>
            </div>
          </div>

          {/* Action area */}
          <div className="flex shrink-0 items-center gap-2">
            {canTopUp && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTopUp}
                className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800/40 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("deposit.topUpButton")}</span>
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="hidden gap-1.5 sm:inline-flex"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("customers.editCustomer")}
              </Button>
            )}
            {(canEdit || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={t("customers.moreActions")}
                    />
                  }
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onRefresh}>
                    <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
                    {t("customerDetails.refresh")}
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={onEdit} className="sm:hidden">
                      <Pencil className="h-4 w-4" />
                      {t("customers.editCustomer")}
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" />
                        {t("customers.deleteCustomer")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
