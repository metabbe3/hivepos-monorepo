"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, AlertTriangle, Timer, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useKanbanOrders, type KanbanOrder } from "@/hooks/use-kanban-orders";

// ponytail: SLATracker reads from the same useKanbanOrders cache as KanbanBoard.
// One fetch per 30s serves both components.

interface SlaItem {
  order: KanbanOrder;
  deadline: Date;
  remaining: number; // ms
  totalSla: number; // ms
  isOverdue: boolean;
  isUrgent: boolean;
}

function detectSlaMs(items: { serviceName: string }[]): number {
  for (const item of items) {
    const lower = item.serviceName.toLowerCase();
    if (lower.includes("7")) return 7 * 60 * 60 * 1000;
    if (lower.includes("24")) return 24 * 60 * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000;
}

function formatRemaining(ms: number, t: (k: string) => string): string {
  if (ms <= 0) return t("dashboard.sla.late");
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const h = t("dashboard.sla.hourShort");
  const m = t("dashboard.sla.minShort");
  if (hours > 0) return `${hours}${h} ${mins}${m}`;
  return `${mins}${m}`;
}

function formatOverdueDuration(ms: number, t: (k: string) => string): string {
  const absMs = Math.abs(ms);
  const hours = Math.floor(absMs / (60 * 60 * 1000));
  const mins = Math.floor((absMs % (60 * 60 * 1000)) / (60 * 1000));
  const h = t("dashboard.sla.hourShort");
  const m = t("dashboard.sla.minShort");
  if (hours > 0) return `${hours}${h} ${mins}${m}`;
  return `${mins}${m}`;
}

function formatTime(date: Date, lang: string): string {
  return date.toLocaleTimeString(lang === "id" ? "id-ID" : "en-US", { hour: "2-digit", minute: "2-digit" });
}

export function SLATracker() {
  const { orders } = useKanbanOrders();
  const [slaItems, setSlaItems] = useState<SlaItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const { t, lang } = useTranslation();

  // Recompute SLA items whenever the shared kanban cache changes.
  // ponytail: filtered + sorted in a single pass; O(n) where n = active orders.
  useEffect(() => {
    if (!orders) return;
    const now = Date.now();
    const items: SlaItem[] = orders
      .filter(
        (o) =>
          o.isExpress && (o.status === "RECEIVED" || o.status === "IN_PROGRESS"),
      )
      .map((o) => {
        const start = o.inProgressAt
          ? new Date(o.inProgressAt).getTime()
          : o.receivedAt
            ? new Date(o.receivedAt).getTime()
            : new Date(o.createdAt).getTime();
        const slaMs = detectSlaMs(o.items);
        const deadline = new Date(start + slaMs);
        const remaining = deadline.getTime() - now;
        return {
          order: o,
          deadline,
          remaining,
          totalSla: slaMs,
          isOverdue: remaining <= 0,
          isUrgent: remaining > 0 && remaining < 60 * 60 * 1000,
        };
      });
    items.sort((a, b) => a.remaining - b.remaining);
    setSlaItems(items);
  }, [orders]);

  // Tick remaining times every minute
  useEffect(() => {
    const tick = setInterval(() => {
      setSlaItems((prev) =>
        prev.map((item) => {
          const remaining = item.deadline.getTime() - Date.now();
          return {
            ...item,
            remaining,
            isOverdue: remaining <= 0,
            isUrgent: remaining > 0 && remaining < 60 * 60 * 1000,
          };
        })
      );
    }, 60000);
    return () => clearInterval(tick);
  }, []);

  if (slaItems.length === 0) return null;

  const MAX_VISIBLE = 3;
  const visibleItems = expanded ? slaItems : slaItems.slice(0, MAX_VISIBLE);
  const hiddenCount = slaItems.length - MAX_VISIBLE;
  const overdueCount = slaItems.filter((i) => i.isOverdue).length;
  const urgentCount = slaItems.filter((i) => i.isUrgent).length;

  return (
    <Card className="border border-border/40 bg-card shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/40">
              <Zap className="h-4 w-4 text-orange-600" />
            </div>
            <CardTitle className="text-base font-bold">{t("dashboard.sla.express")}</CardTitle>
            <Badge variant="secondary" className="text-xs px-1.5">
              {slaItems.length} {t("dashboard.sla.active")}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} {t("dashboard.sla.overdue")}
              </Badge>
            )}
            {urgentCount > 0 && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs gap-1">
                <Timer className="h-3 w-3" />
                {urgentCount} {t("dashboard.sla.urgent")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const progressPercent = item.isOverdue
              ? 100
              : Math.max(0, Math.min(100, ((item.totalSla - item.remaining) / item.totalSla) * 100));
            const barColor = item.isOverdue
              ? "bg-red-500"
              : item.isUrgent
                ? "bg-amber-500"
                : "bg-blue-500";

            const startMs = item.order.inProgressAt
              ? new Date(item.order.inProgressAt).getTime()
              : item.order.receivedAt
                ? new Date(item.order.receivedAt).getTime()
                : new Date(item.order.createdAt).getTime();
            const startTime = formatTime(new Date(startMs), lang);
            const deadlineTime = formatTime(item.deadline, lang);

            const currentCheckpoint = item.order.status === "IN_PROGRESS" ? "washing" : "received";

            const cpReceived = currentCheckpoint === "received" || currentCheckpoint === "washing"
              ? "bg-blue-500" : "bg-muted-foreground/30";
            const cpWashing = currentCheckpoint === "washing"
              ? "bg-amber-500 animate-pulse" : "bg-muted-foreground/30";

            const firstSegmentProgress = currentCheckpoint === "received"
              ? Math.min(progressPercent * 2, 100)
              : 100;
            const secondSegmentProgress = currentCheckpoint === "washing"
              ? Math.min((progressPercent - 50) * 2, 100)
              : 0;

            return (
              <div
                key={item.order.id}
                className={`rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm ${
                  item.isOverdue
                    ? "border-red-200 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/50 animate-pulse-subtle"
                    : item.isUrgent
                      ? "border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/50"
                      : "border-border/50 bg-card/60 hover:border-border"
                }`}
                onClick={() => router.push(`/laundry/orders/${item.order.id}`)}
              >
                {/* Customer name prominent, Order ID secondary */}
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">
                      {item.order.customerName}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      {item.order.orderNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    {item.isOverdue ? (
                      <Badge variant="destructive" className="text-[11px] gap-0.5 px-1.5 py-0">
                        <AlertTriangle className="h-3 w-3" />
                        {formatOverdueDuration(item.remaining, t)} {t("dashboard.sla.overdueLabel")}
                      </Badge>
                    ) : item.isUrgent ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[11px] gap-0.5 px-1.5 py-0">
                        <Timer className="h-3 w-3" />
                        {formatRemaining(item.remaining, t)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px] gap-0.5 px-1.5 py-0">
                        <Clock className="h-3 w-3" />
                        {formatRemaining(item.remaining, t)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Timeline with checkpoints */}
                <div className="flex items-center gap-0">
                  {/* Received */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-3 h-3 rounded-full ${cpReceived} ring-2 ring-card`} />
                    <span className="text-[9px] mt-0.5 text-muted-foreground w-8 text-center">{startTime}</span>
                  </div>
                  {/* Segment 1 */}
                  <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${currentCheckpoint === "received" ? barColor : "bg-blue-400"}`} style={{ width: `${firstSegmentProgress}%` }} />
                  </div>
                  {/* Washing */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-3 h-3 rounded-full ${cpWashing} ring-2 ring-card`} />
                    <span className="text-[9px] mt-0.5 text-muted-foreground w-8 text-center">{t("dashboard.sla.washing")}</span>
                  </div>
                  {/* Segment 2 */}
                  <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden relative">
                    <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${secondSegmentProgress}%` }} />
                  </div>
                  {/* Done / Deadline */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-3 h-3 rounded-full ${item.isOverdue ? "bg-red-500" : "bg-muted-foreground/30"} ring-2 ring-card`} />
                    <span className={`text-[9px] mt-0.5 w-8 text-center ${item.isOverdue ? "text-red-500 font-bold" : "text-muted-foreground"}`}>{deadlineTime}</span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground mt-1">
                  SLA: {item.totalSla / (60 * 60 * 1000)}j — Due: {deadlineTime}
                </p>
              </div>
            );
          })}
        </div>
        {hiddenCount > 0 && (
          <button
            className="flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                {t("dashboard.sla.showLess")}
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                {t("dashboard.sla.showAll").replace("{count}", String(slaItems.length))}
              </>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
