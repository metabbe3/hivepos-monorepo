"use client";

import { useEffect, useState } from "react";

/**
 * Single source of truth for browser-determined online/offline state.
 *
 * ponytail: trusts navigator.onLine which itself trusts the OS network
 * stack. This is fine for v1 — "wifi dropped entirely" is the trigger we
 * care about. Upgrade path: add a manual "ping" health check on an interval
 * to catch the "wifi bars but no internet" case (captive portal, DNS down).
 */
export function useOnlineStatus(): boolean {
  // ponytail: initialize to true (matches SSR) — reading navigator.onLine
  // in the useState initializer breaks hydration when the browser is offline
  // at load. Real value is synced in the effect below after hydration.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
