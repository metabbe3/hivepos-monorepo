"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, MessageCircle, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { renderWhatsAppTemplate, type TemplateOverrides } from "@/lib/whatsapp-templates";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";
import { useWhatsappTemplates } from "@/hooks/use-whatsapp-templates";
import { PAYMENT_STATUS_CONFIG } from "@/lib/constants";
import type { UnpaidOrder } from "./dashboard-types";

interface Props {
  orders: UnpaidOrder[];
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function agingBadge(days: number) {
  if (days <= 3) return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]">{days}d</Badge>;
  if (days <= 7) return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-[10px]">{days}d</Badge>;
  return <Badge variant="destructive" className="text-[10px]">{days}d</Badge>;
}

function buildWhatsAppLink(phone: string, orderNumber: string, overrides?: TemplateOverrides): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  const waNumber = cleaned.startsWith("0") ? "62" + cleaned.slice(1) : cleaned;
  const message = renderWhatsAppTemplate("unpaid.reminder", { orderNumber }, overrides);
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
}

export function UnpaidOrdersCard({ orders }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const whatsappTemplates = useWhatsappTemplates();

  if (!orders.length) return null;

  const totalUnpaid = orders.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <TooltipProvider>
      <Card className="border border-border/40 bg-card shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Piutang</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-semibold text-red-600">{formatCurrency(totalUnpaid)}</span> belum dibayar
              </p>
            </div>
            <Badge variant="destructive" className="ml-auto text-xs">{orders.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {orders.map((order) => {
              const payConfig = PAYMENT_STATUS_CONFIG[order.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG];
              const days = daysSince(order.createdAt);
              const initial = order.customerName.charAt(0).toUpperCase() || "?";
              return (
                <div
                  key={order.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/60 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => router.push(`/laundry/orders/${order.id}`)}
                >
                  <Avatar className="h-9 w-9 bg-gradient-to-br from-sky-500 to-sky-600 text-white shrink-0">
                    <AvatarFallback className="bg-transparent text-white font-semibold text-sm">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono font-semibold text-muted-foreground truncate">
                        {order.orderNumber}
                      </p>
                      <Badge className={`${payConfig?.color || ""} text-[10px] px-1.5 py-0`}>
                        {t(payConfig?.labelKey || order.paymentStatus)}
                      </Badge>
                      {agingBadge(days)}
                    </div>
                    <p className="text-sm font-medium truncate mt-0.5">{order.customerName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(order.totalAmount)}</p>
                    <div className="flex items-center gap-0.5">
                      {order.customerPhone && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                                aria-label={`WhatsApp ${order.customerName}`}
                                title="WhatsApp"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  window.open(buildWhatsAppLink(order.customerPhone, order.orderNumber, whatsappTemplates), "_blank");
                                }}
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                          <TooltipContent>{t("orders.remindWhatsapp")}</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              aria-label={t("orders.viewOrder")}
                              title={t("orders.viewOrder")}
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                router.push(`/laundry/orders/${order.id}`);
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <TooltipContent>{t("orders.viewOrder")}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
