"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { drainOutbox, purgeOldSyncedRows, onSyncEvent } from "@/lib/offline/sync-engine";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { useTranslation } from "@/hooks/use-translation";
import { shortPendingId } from "@/lib/offline/client-id";

/**
 * Mount once in the dashboard layout. Handles:
 *  - Kick-off drainOutbox() when the browser fires `online`.
 *  - Periodic purge of synced rows older than 24h.
 *  - Toasts on per-row sync events (success + failure).
 *
 * ponytail: a single mounted instance owns the schedule. If we ever need
 * multiple instances, lift drain trigger to a context provider.
 */
export function OfflineSyncManager() {
  const online = useOnlineStatus();
  const offlineEnabled = useFeatureFlag("offlineOrderCreate");
  const { t } = useTranslation();

  useEffect(() => {
    if (!online || !offlineEnabled) return;
    drainOutbox().catch(() => {
      /* swallow — sync-engine handles per-row errors */
    });
  }, [online, offlineEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      purgeOldSyncedRows().catch(() => {});
    }, 10 * 60 * 1000); // every 10 min
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub = onSyncEvent((e) => {
      if (e.type === "order-synced") {
        toast.success(
          t("offline.orderSynced")
            .replace("{pendingId}", shortPendingId(e.clientId))
            .replace("{orderNumber}", e.orderNumber),
        );
      } else if (e.type === "row-error") {
        toast.error(
          t("offline.orderSyncFailed").replace("{error}", e.error),
        );
      }
    });
    return unsub;
  }, [t]);

  return null;
}
