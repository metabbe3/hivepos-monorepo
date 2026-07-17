"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Printer,
  Share2,
  Pencil,
  Trash2,
  MoreVertical,
  Banknote,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  ORDER_STATUS_FLOW,
} from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { OrderDetail } from "./order-types";

interface Props {
  order: OrderDetail;
  isEmployee: boolean;
  editMode: boolean;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdvanceStatus: () => void;
  onPay: () => void;
  onCancelEdit: () => void;
}

export function OrderDetailHeader({
  order,
  isEmployee,
  editMode,
  onShare,
  onEdit,
  onDelete,
  onAdvanceStatus,
  onPay,
  onCancelEdit,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const currentStatusIdx = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextStatus =
    currentStatusIdx < ORDER_STATUS_FLOW.length - 1
      ? ORDER_STATUS_FLOW[currentStatusIdx + 1]
      : null;
  const remaining = order.totalAmount - order.paidAmount;
  const canAdvance = !isEmployee && order.status !== "DELIVERED" && nextStatus;
  const canPay = !isEmployee && remaining > 0;
  const canEdit = !isEmployee && order.status !== "DELIVERED";
  const canDelete = !isEmployee;

  const statusCfg = ORDER_STATUS_CONFIG[order.status];
  const payCfg = PAYMENT_STATUS_CONFIG[order.paymentStatus];

  return (
    <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
      <div className="h-1.5 w-full bg-gradient-to-r from-brand-600 to-brand-700" />
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/laundry/orders")}
              className="shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl sm:text-2xl font-bold tracking-tight">
                  {order.orderNumber}
                </h1>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={t("orders.copyOrderNumber")}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(order.orderNumber);
                      toast.success(t("orders.orderNumberCopied"));
                    } catch {
                      toast.error(t("orders.copyFailed"));
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Badge className={cn(statusCfg.color, "border-0")}>
                  {t(statusCfg.labelKey)}
                </Badge>
                <Badge className={cn(payCfg.color, "border-0")}>
                  {t(payCfg.labelKey)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDateTime(order.receivedAt || order.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {editMode ? (
              <Button variant="outline" size="sm" onClick={onCancelEdit}>
                {t("common.cancel")}
              </Button>
            ) : (
              <>
                {canAdvance && (
                  <Button
                    size="default"
                    onClick={onAdvanceStatus}
                    className="gap-1.5"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {t("orderDetails.markAs").replace(
                        "{status}",
                        t(ORDER_STATUS_CONFIG[nextStatus!].labelKey),
                      )}
                    </span>
                    <span className="sm:hidden">
                      {t(ORDER_STATUS_CONFIG[nextStatus!].labelKey)}
                    </span>
                  </Button>
                )}
                {canPay && (
                  <Button
                    size="default"
                    variant="outline"
                    onClick={onPay}
                    className="shrink-0 gap-1.5"
                    aria-label={t("orderDetails.recordPayment")}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t("orderDetails.recordPayment")}</span>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t("customers.moreActions")}
                      />
                    }
                  >
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`/laundry/orders/${order.id}/receipt`)
                      }
                    >
                      <Printer className="h-4 w-4" />
                      {t("receipt.title") ?? "Receipt"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onShare}>
                      <Share2 className="h-4 w-4" />
                      Share
                    </DropdownMenuItem>
                    {canEdit && (
                      <DropdownMenuItem onClick={onEdit}>
                        <Pencil className="h-4 w-4" />
                        {t("orders.editOrder")}
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={onDelete}>
                          <Trash2 className="h-4 w-4" />
                          {t("orders.deleteOrder")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
