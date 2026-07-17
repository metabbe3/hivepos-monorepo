"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { useSyncStatus } from "@/lib/offline/use-sync-status";
import { listPendingOrders, deletePendingOrder, type PendingOrderRow } from "@/lib/offline/db";
import { drainOutbox } from "@/lib/offline/sync-engine";
import { shortPendingId } from "@/lib/offline/client-id";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Shows IDB outbox rows (pending/syncing/synced/error) on /laundry/orders so the
// kasir can see orders created while offline, watch them sync, and recover stuck
// rows. Self-gates: renders nothing when the flag is off or there are no rows.
// Synced rows are hidden (the engine purges them after 24h via purgeOldSyncedRows).

const STATUS_STYLE: Record<PendingOrderRow["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  syncing: "bg-blue-100 text-blue-700",
  synced: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};
const STATUS_KEY: Record<PendingOrderRow["status"], string> = {
  pending: "offline.statusPending",
  syncing: "offline.statusSyncing",
  synced: "offline.statusSynced",
  error: "offline.statusError",
};

function itemSummary(row: PendingOrderRow): string {
  return row.pricedItems
    .map((p) => (p.weightKg ? `${p.weightKg}kg ${p.serviceName}` : `${p.quantity}× ${p.serviceName}`))
    .join(", ");
}

export function PendingOrdersSection() {
  const enabled = useFeatureFlag("offlineOrderCreate");
  const online = useOnlineStatus();
  const { pendingCount, errorCount, draining } = useSyncStatus();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [rows, setRows] = useState<PendingOrderRow[]>([]);

  const reload = useCallback(async () => {
    if (!enabled) { setRows([]); return; }
    try { setRows(await listPendingOrders()); } catch { /* IDB read failure — keep stale */ }
  }, [enabled]);

  // useSyncStatus flips as rows move pending→syncing→synced→error, so it drives refresh.
  useEffect(() => { void reload(); }, [reload, pendingCount, errorCount, draining]);

  if (!enabled) return null;
  const active = rows.filter((r) => r.status !== "synced");
  if (active.length === 0) return null;

  const onSync = async () => {
    try { await drainOutbox(); } catch { /* per-row errors surface via row-error events */ }
  };
  const onDelete = async (row: PendingOrderRow) => {
    const ok = await confirm({
      title: t("offline.confirmDeleteTitle"),
      description: t("offline.confirmDeleteBody"),
      confirmLabel: t("offline.delete"),
      destructive: true,
    });
    if (!ok) return;
    await deletePendingOrder(row.clientId);
    toast.success(t("offline.deleted"));
    void reload();
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold">{t("offline.pendingFilter")}</h2>
            <span className="sa-tnum rounded-full bg-amber-200/60 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {active.length}
            </span>
            {draining && <span className="text-xs text-muted-foreground">{t("offline.draining")}</span>}
          </div>
          {online && (
            <Button variant="outline" size="sm" onClick={onSync} disabled={draining}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${draining ? "animate-spin" : ""}`} />
              {t("offline.syncNow")}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {active.map((row) => (
            <div
              key={row.clientId}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="sa-tnum font-mono text-xs font-bold">{shortPendingId(row.clientId)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[row.status]}`}>
                    {t(STATUS_KEY[row.status])}
                  </span>
                  {row.serverOrderNumber && (
                    <span className="text-[11px] text-muted-foreground">→ {row.serverOrderNumber}</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{itemSummary(row)}</p>
                {row.status === "error" && row.lastError && (
                  <p className="mt-0.5 truncate text-xs text-destructive">{row.lastError}</p>
                )}
              </div>
              <span className="sa-tnum shrink-0 text-sm font-bold">{formatCurrency(row.totalAmount)}</span>
              {(row.status === "error" || row.status === "pending") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={t("offline.delete")}
                  onClick={() => void onDelete(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
