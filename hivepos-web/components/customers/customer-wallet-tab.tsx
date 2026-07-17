"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTableCard, type Column } from "@/components/shared/data-table-card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { DEPOSIT_TRANSACTION_TYPE_CONFIG } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";
import type { DepositTransaction } from "./types";

interface CustomerWalletTabProps {
  deposits: DepositTransaction[];
}

type FilterKey = "all" | "TOP_UP" | "DEDUCTION" | "REFUND";

export function CustomerWalletTab({ deposits }: CustomerWalletTabProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = deposits.filter((d) => filter === "all" || d.type === filter);

  const FILTERS: { value: FilterKey; label: string }[] = [
    { value: "all", label: t("deposit.allTypes") },
    { value: "TOP_UP", label: t(DEPOSIT_TRANSACTION_TYPE_CONFIG.TOP_UP.labelKey) },
    { value: "DEDUCTION", label: t(DEPOSIT_TRANSACTION_TYPE_CONFIG.DEDUCTION.labelKey) },
    { value: "REFUND", label: t(DEPOSIT_TRANSACTION_TYPE_CONFIG.REFUND.labelKey) },
  ];

  const columns: Column<DepositTransaction>[] = [
    {
      header: t("common.date"),
      render: (d) => formatDateTime(d.createdAt),
      className: "text-muted-foreground",
    },
    {
      header: t("reports.type"),
      align: "center",
      render: (d) => {
        const cfg =
          DEPOSIT_TRANSACTION_TYPE_CONFIG[d.type as keyof typeof DEPOSIT_TRANSACTION_TYPE_CONFIG];
        return (
          <Badge className={cfg?.color ?? ""}>
            {t(cfg?.labelKey ?? d.type)}
          </Badge>
        );
      },
    },
    {
      header: t("common.amount"),
      align: "right",
      render: (d) => {
        const isCredit = d.type === "TOP_UP" || d.type === "REFUND";
        return (
          <span
            className={cn(
              "font-medium tabular-nums",
              isCredit
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {isCredit ? "+" : "—"}
            {formatCurrency(d.amount)}
          </span>
        );
      },
    },
    {
      header: t("deposit.balanceAfter"),
      align: "right",
      render: (d) => formatCurrency(d.balanceAfter),
      className: "tabular-nums",
    },
    {
      header: t("deposit.description"),
      render: (d) => d.description || "—",
      className: "max-w-[200px] truncate text-muted-foreground",
    },
  ];

  return (
    <DataTableCard
      title={t("deposit.history")}
      columns={columns}
      rows={filtered}
      rowKey={(d) => d.id}
      emptyMessage={t("deposit.noHistory")}
      headerExtra={
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                filter === f.value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
