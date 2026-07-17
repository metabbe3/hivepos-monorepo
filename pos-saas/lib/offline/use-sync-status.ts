"use client";

import { useEffect, useState } from "react";
import { listPendingOrders, listPendingCustomers } from "./db";
import { onSyncEvent } from "./sync-engine";

export interface SyncStatus {
  pendingCount: number;
  errorCount: number;
  draining: boolean;
}

/**
 * Subscribes to sync-engine events + re-reads IDB counts so the UI pill
 * stays accurate. Returns zero counts on SSR / when IDB is unavailable.
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    pendingCount: 0,
    errorCount: 0,
    draining: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const [orders, customers] = await Promise.all([
          listPendingOrders(),
          listPendingCustomers(),
        ]);
        if (cancelled) return;
        const pendingCount =
          orders.filter((o) => o.status === "pending" || o.status === "syncing").length +
          customers.filter((c) => c.status === "pending" || c.status === "syncing").length;
        const errorCount =
          orders.filter((o) => o.status === "error").length +
          customers.filter((c) => c.status === "error").length;
        setStatus((prev) => ({ ...prev, pendingCount, errorCount }));
      } catch {
        // IDB unavailable — leave defaults.
      }
    }

    refresh();
    const unsub = onSyncEvent((e) => {
      if (e.type === "started") {
        setStatus((prev) => ({ ...prev, draining: true }));
      } else if (e.type === "completed") {
        setStatus((prev) => ({ ...prev, draining: false }));
        refresh();
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return status;
}
