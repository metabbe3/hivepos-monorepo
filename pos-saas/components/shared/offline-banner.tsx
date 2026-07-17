"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { useSyncStatus } from "@/lib/offline/use-sync-status";
import { useTranslation } from "@/hooks/use-translation";
import { drainOutbox } from "@/lib/offline/sync-engine";

/**
 * Sticky banner shown when navigator.onLine is false, plus a compact
 * "pending sync" pill that surfaces the outbox state even when online.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const sync = useSyncStatus();
  const { t } = useTranslation();

  // ponytail: when online and nothing pending, render nothing. Avoids
  // reserving layout space when the feature is dormant.
  if (online && sync.pendingCount === 0 && sync.errorCount === 0) return null;

  const showOffline = !online;
  const showPending = online && (sync.pendingCount > 0 || sync.errorCount > 0 || sync.draining);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium text-white ${
        showOffline ? "bg-amber-600" : "bg-indigo-600"
      }`}
    >
      <div className="flex items-center gap-2">
        {showOffline ? <CloudOff className="h-4 w-4" /> : <RefreshCw className={`h-4 w-4 ${sync.draining ? "animate-spin" : ""}`} />}
        <span>
          {showOffline
            ? t("offline.banner")
            : sync.draining
              ? t("offline.draining")
              : sync.errorCount > 0
                ? t("offline.errorCount").replace("{count}", String(sync.errorCount))
                : t("offline.pendingCount").replace("{count}", String(sync.pendingCount))}
        </span>
      </div>
      {showPending && (
        <button
          type="button"
          onClick={() => {
            drainOutbox().catch(() => {});
          }}
          className="rounded-md bg-white/15 px-2 py-1 text-xs hover:bg-white/25"
        >
          <RefreshCw className={`inline h-3 w-3 ${sync.draining ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
}
