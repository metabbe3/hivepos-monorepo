"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  ChevronRight,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  RefreshCw,
  Zap,
  Inbox,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "@/lib/constants";
import { renderWhatsAppTemplate, type TemplateOverrides } from "@/lib/whatsapp-templates";
import { useWhatsappTemplates } from "@/hooks/use-whatsapp-templates";
import { useTranslation } from "@/hooks/use-translation";
import { useKanbanOrders, type KanbanOrder } from "@/hooks/use-kanban-orders";

// ponytail: alias KanbanOrder → KanbanItem locally so the presentational
// layer keeps its old name without re-touching every reference below.
type KanbanItem = KanbanOrder;

const STATUS_FLOW: Record<string, string> = {
  RECEIVED: "IN_PROGRESS",
  IN_PROGRESS: "READY",
  READY: "DELIVERED",
};

const COLUMNS = [
  {
    key: "RECEIVED",
    labelKey: "dashboard.kanban.queue",
    icon: Clock,
    borderColor: "border-t-sky-500",
    headerBg: "bg-sky-50 dark:bg-sky-950/30",
    headerText: "text-sky-700 dark:text-sky-300",
    dotColor: "bg-sky-500",
    columnBg: "bg-sky-50/20 dark:bg-sky-950/10",
  },
  {
    key: "IN_PROGRESS",
    labelKey: "dashboard.kanban.processing",
    icon: Package,
    borderColor: "border-t-amber-500",
    headerBg: "bg-amber-50 dark:bg-amber-950/30",
    headerText: "text-amber-700 dark:text-amber-300",
    dotColor: "bg-amber-500",
    columnBg: "bg-amber-50/20 dark:bg-amber-950/10",
  },
  {
    key: "READY",
    labelKey: "dashboard.kanban.readyPickup",
    icon: CheckCircle2,
    borderColor: "border-t-emerald-500",
    headerBg: "bg-emerald-50 dark:bg-emerald-950/30",
    headerText: "text-emerald-700 dark:text-emerald-300",
    dotColor: "bg-emerald-500",
    columnBg: "bg-emerald-50/20 dark:bg-emerald-950/10",
  },
  {
    key: "DELIVERED",
    labelKey: "dashboard.kanban.completed",
    icon: Truck,
    borderColor: "border-t-stone-400 dark:border-t-stone-600",
    headerBg: "bg-stone-50 dark:bg-stone-900/30",
    headerText: "text-stone-600 dark:text-stone-400",
    dotColor: "bg-stone-400",
    columnBg: "bg-stone-50/20 dark:bg-stone-900/10",
  },
] as const;

function buildWhatsAppLink(
  phone: string,
  orderNumber: string,
  status: string,
  overrides?: TemplateOverrides,
): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  const waNumber = cleaned.startsWith("0") ? "62" + cleaned.slice(1) : cleaned;
  const templateId = `status.${status}` as "status.READY" | "status.RECEIVED" | "status.IN_PROGRESS" | "status.DELIVERED";
  const message = renderWhatsAppTemplate(templateId, { orderNumber }, overrides);
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
}

function KanbanOrderCard({
  order,
  onAdvance,
  advancing,
  whatsappTemplates,
}: {
  order: KanbanItem;
  onAdvance: (id: string, next: string) => void;
  advancing: string | null;
  whatsappTemplates: TemplateOverrides;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const statusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG];
  const payConfig = PAYMENT_STATUS_CONFIG[order.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG];
  const nextStatus = STATUS_FLOW[order.status];
  const isAdvancing = advancing === order.id;
  const mainItem = order.items[0];
  const extraCount = order.items.length - 1;

  return (
    <Card
      className="cursor-pointer border border-border/50 bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
      tabIndex={0}
      role="button"
      aria-label={`${order.customerName} - ${order.orderNumber}`}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/laundry/orders/${order.id}`);
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", order.id);
        e.dataTransfer.setData("application/status", order.status);
        e.currentTarget.style.opacity = "0.5";
      }}
      onDragEnd={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
      onClick={() => router.push(`/laundry/orders/${order.id}`)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{order.customerName}</p>
            <p className="text-[11px] font-mono text-muted-foreground truncate">
              {order.orderNumber}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {order.isExpress && (
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-[11px] px-1.5 py-0">
                <Zap className="h-3 w-3 mr-0.5" />{t("dashboard.express")}
              </Badge>
            )}
          </div>
        </div>

        {mainItem && (
          <p className="text-xs text-muted-foreground truncate">
            {mainItem.serviceName}
            {extraCount > 0 && <span className="ml-1">+{extraCount}</span>}
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`${statusConfig?.color || ""} text-[11px] px-1.5 py-0`}>
            {t(statusConfig?.labelKey || order.status)}
          </Badge>
          <Badge className={`${payConfig?.color || ""} text-[11px] px-1.5 py-0`}>
            {t(payConfig?.labelKey || order.paymentStatus)}
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-sm font-bold">{formatCurrency(order.totalAmount)}</p>
          <div className="flex items-center gap-1">
            {order.customerPhone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(buildWhatsAppLink(order.customerPhone, order.orderNumber, order.status, whatsappTemplates), "_blank");
                }}
                aria-label={`WhatsApp ${order.customerName}`}
                title="WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            {nextStatus && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvance(order.id, nextStatus);
                }}
                disabled={isAdvancing}
                aria-label={t("dashboard.kanban.advanceAria").replace("{name}", order.customerName)}
                title={t("dashboard.kanban.advanceTitle")}
              >
                {isAdvancing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KanbanBoard() {
  const { orders: hookOrders, loading, refetch } = useKanbanOrders();
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const whatsappTemplates = useWhatsappTemplates();
  const { t } = useTranslation();

  const orders = hookOrders ?? [];

  const handleAdvance = async (orderId: string, nextStatus: string) => {
    setAdvancing(orderId);
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      toast.success(t("orders.statusUpdated"));
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("orders.failedUpdate"));
    } finally {
      setAdvancing(null);
    }
  };

  if (loading) {
    return (
      <Card className="border border-border/40 bg-card shadow-sm">
        <CardContent className="p-6 text-center text-muted-foreground">
          {t("dashboard.loading")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 sm:grid sm:grid-cols-2 xl:grid xl:grid-cols-4 sm:overflow-visible sm:pb-0">
      {COLUMNS.map((col) => {
        const colOrders = orders.filter((o) => o.status === col.key);
        const Icon = col.icon;
        const totalAmount = colOrders.reduce((sum, o) => sum + o.totalAmount, 0);

        return (
          <div
            key={col.key}
            className={`min-w-[280px] snap-start sm:min-w-0 space-y-2 rounded-xl p-3 ${col.columnBg} ${dragOverCol === col.key ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.key);
            }}
            onDragLeave={() => {
              if (dragOverCol === col.key) setDragOverCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverCol(null);
              const orderId = e.dataTransfer.getData("text/plain");
              const fromStatus = e.dataTransfer.getData("application/status");
              if (orderId && fromStatus !== col.key) {
                // Only allow forward movement through STATUS_FLOW
                const nextStatus = STATUS_FLOW[fromStatus as keyof typeof STATUS_FLOW];
                if (nextStatus === col.key) {
                  handleAdvance(orderId, nextStatus);
                }
              }
            }}
          >
            {/* Column header */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${col.headerBg} border-t-[3px] ${col.borderColor}`}>
              <Icon className={`h-4 w-4 ${col.headerText}`} />
              <span className="text-sm font-semibold">{t(col.labelKey)}</span>
              <Badge variant="secondary" className="ml-auto text-xs px-2 h-5 min-w-[24px] flex items-center justify-center">
                {colOrders.length}
              </Badge>
            </div>

            {/* Order cards */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {colOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                  <Inbox className="h-8 w-8 mb-2" />
                  <p className="text-xs">{t("dashboard.noOrdersInColumn")}</p>
                </div>
              ) : (
                colOrders.map((order) => (
                  <KanbanOrderCard
                    key={order.id}
                    order={order}
                    onAdvance={handleAdvance}
                    advancing={advancing}
                    whatsappTemplates={whatsappTemplates}
                  />
                ))
              )}
            </div>

            {/* Column total */}
            {colOrders.length > 0 && (
              <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground text-center">
                Total: <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
